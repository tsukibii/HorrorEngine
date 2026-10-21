# Animation: bodies from text, faces from takes, grabs from IK

**The split:**
- **Claude:** prompts the body animation and checks it lands, builds the systems (idles, the grab), and places
  the animations on the scenes.
- **You:** do the face mocap and the final touches on hero moments.

## 0. Blocking in the director first

Every body starts as **blocking in the director's desk**: pose keys on the previs skeleton (`Content/Studio/poses.json`,
UE mannequin bone names), eased like Blender's interpolation and played on the clip's timeline from the player's eye.
The whole game is blocked and reviewed there before anything is generated or built:

- **Pose keys:** `at` 0..1 of the clip, a pose, the ease into it (`linear in out inout snap hold overshoot`), `walk`
  to stride while travelling, and `move` to travel to a stage mark.
- **Modifiers** for what text-to-motion does badly:
  - `snap`: creep, then strike (jumpscares)
  - `hold`: freeze mid-motion
  - `twitch`: uncanny stutter
  - `ease`: soft start and end
  - `speed`, `ramp`, `trim`, `loop`, `mirror`
- **Joins:** `blend` (a crossfade from the actor's previous clip) or `bridge` (an in-between). A blend under a seam
  is invisible.
- **The body check** (desk, "Check bodies"), all judged from the player's eye:
  - which body parts the player sees, and what hides the rest (only visible parts need fixing)
  - shot sizes that read wider than their label (with a one-click lens fix)
  - pose jumps between clips (with a one-click blend or in-between)
  - generated motions longer or shorter than the take (hold, loop, pad, or a speed modifier)
- **The storyboard tab:** every clip as a frame, plus seam frames and task, choice and ending cards. It's the
  reference Unreal is built to.
- **Export glTF** writes the scene's blocking (the previs skeleton, a simple skinned body, one animation per clip,
  named by take id) to `Content/Games/<Game>/Previs/`. In Unreal (SETUP S8): import it with Interchange, then an IK
  Retargeter (previs → UE mannequin and MetaHuman, set up once; the T-pose rest and mannequin bone names make it
  near one-to-one). The greybox stand-ins play the same blocking the desk showed.

**Real bodies:** the desk draws the blocking on the capsule figure until a rigged human is in
`Content/Studio/Bodies/` (Manny or Quinn exported as FBX, Mixamo, a MetaHuman body; its README). `bodies.js` finds
the bones by name (mannequin, Mixamo, common names; UE5's five-bone spine too), faces and scales the model from its own
joints (Z-up files work), and aims each bone along its previs bone (a direction and a secondary axis), so blocked poses
and generated motions (positions only) both drive it. The Bodies page (`bodies.html`) shows a body through every pose
beside the previs skeleton, with the mapped and missing bones. Choose per game or per cast member in the Game panel
(`previs_body`). Shots, framing and the visibility test still use the previs joints, so they don't change with the body.

The blocking also feeds generation: `motion.py jobs` turns each clip's pose keys into **Kimodo full-body keyframe
constraints**, so the generated motion follows the approved staging, and makes in-between jobs for `bridge` joins.
`motion.py preview` turns results back into desk files (`body.file`), which play instead of the blocking: watch,
check, fix, repeat.

## 0b. How the desk poses a body (layers, in order)

1. **Retarget** (`bodies.js`): limbs are aimed bone by bone at the source's joints (positions, so A-pose and T-pose
   rigs both work); the **trunk** (pelvis, spine, neck, head) is turned by how far the source bone turned from its
   own rest, so each body keeps its own spine curve. (Aiming the trunk tipped MHR's pelvis forward: its
   pelvis-to-spine joint points backwards by anatomy, which pushed the hips back.)
2. **Hands and twist:** relaxed finger curls on blocked poses (Kimodo motions bring their own fingers); MHR's twist
   bones share out forearm, upper-arm, thigh and shin roll.
3. **IK** (`reach`): hands locked onto targets with a two-bone solve, the elbow swinging away from the body.
4. **No clipping:** elliptical capsules for belly, chest and head, measured from this character's own shaped skin
   (a heavy body gets big ones), push the arms out by turning them at the shoulder and elbow. Skin may sink a little.
5. **Squash:** where an arm still presses in, the soft flesh (trunk-weighted skin) gives way around it in the shader,
   instead of the arm passing through.

In Unreal the same jobs are done by: the IK Retargeter (1), MetaHuman's twist and corrective joints, driven by pose
solvers in its post-process Anim Blueprint (2 and 5: the elbow, shoulder and knee squash comes with every MetaHuman
body), Control Rig with full-body IK (3), and Control Rig collision or a physics asset with sphere/capsule bodies (4).

## 1. Bodies: NVIDIA Kimodo

**Installed from source with uv, all in one folder** (`python setup/setup.py kimodo`, SETUP S11; no Docker: images
land on the system drive). `tools/kimodo.py` runs it with every cache (uv, Python, the ~20 GB of models, torch,
temp) pointed into that folder. Kimodo's SOMA skeleton has **77 joints** (every finger, toes, jaw, eyes) and its
body layer is built on MHR, so its motions fit the desk's MHR body:
- `motion.py constrain` turns each clip's blocking into Kimodo **full-body keyframes** (fitted on Kimodo's own
  skeleton with its forward kinematics, bone directions within a degree of the blocking; relaxed hands from Kimodo)
  and blocked walks into **2D root keys**: `tools/kimodo_constrain.py`, run inside the environment.
- `motion.py preview` keeps all 77 joints in the desk file (`soma:<Name>`), and the desk drives **every MHR bone**
  from them: spine and neck chains, eyes, fingers and thumbs, feet and toes, with MHR's twist bones sharing out the
  forearm, shin, upper-arm and thigh roll (`bodies.js`). Blocked poses (25 joints) still play, with relaxed fingers
  and the same twist sharing.
- Tested here: the build (uv, Python, NVIDIA's pinned packages, the C++ motion correction), constraint files read
  back by Kimodo's own loader with 0.00 cm round trip, and a Kimodo-format motion driving MHR in the storyboard.
  Not testable without a GPU and the gated text encoder: generation itself (the first `motion.py run`).

Older notes on the model:

**Kimodo** (NVIDIA, open-sourced March 2026, v1.1 in April) is a kinematic motion diffusion model: text in,
humanoid motion out.
- **Constraints:** what makes it fit a pipeline instead of a slot machine:
  - full-body pose keyframes
  - hand and foot positions and rotations at chosen frames
  - a 2D root path or waypoints
  - several prompts placed along a timeline
- **Licence:**
  - the code is Apache-2.0
  - the human-body (SOMA) checkpoints are under the **NVIDIA Open Model License**: read it once before shipping
    (it's NVIDIA's commercial-friendly model licence, with an acceptable-use policy)
  - the SMPL-X checkpoint is research-only: don't use it
- **Running it:**
  - developed on Linux; on Windows we build it from source with uv (setup.py kimodo), not Docker
  - about 17 GB of VRAM entirely on the GPU, or under 3 GB with the text encoder on the CPU
    (`TEXT_ENCODER_DEVICE=cpu`, slower)
  - CLI: `kimodo_gen`; a local web demo on 127.0.0.1:7860; a Python API
  - output is NPZ (joints, rotations, foot contacts, root); no FBX from NVIDIA

**Two ways in. Try A first.**

**A. The Animotive Kimodo plugin (free on Fab).**
- It generates from a prompt straight into Sequencer, retargeted onto a MetaHuman or another humanoid.
- Backends: a local Docker server, a remote URL, or Animotive's hosted service (an API key).
- Needs Control Rig, IK Rig, Animation Modifier Library and Editor Scripting Utilities (it enables them itself).
- **To check in SETUP S11:** whether it can be driven from Python or a Blueprint call, not only its toolbar
  button. If it can, Claude runs `motion.py`'s jobs through it; if not, you press Generate per job from the job list
  (a minute each), and Claude does the rest.

**B. Local Kimodo + our tools (fully scriptable).**
- `tools/motion.py jobs` → `run` (the local CLI, configured in `setup/kimodo.json`) → convert to FBX → import →
  retarget to the MetaHuman with an IK Retargeter.
- The conversion is the work: the community ComfyUI-Kimodo has an FBX exporter that retargets onto a Mixamo rig,
  and Mixamo to MetaHuman is a standard Unreal retarget.
- Use B if A can't be scripted, or for batches.

**The loop, either way:**
1. A clip's `body` (STORY_FORMAT §3.5) says what to do, sized to the clip's take, from and to an idle, along the
   stage marks, the hand reaching the player's collar at the grab frame.
2. `motion.py jobs` writes one job per clip, with its constraints in the actor's own frame.
3. Generate.
4. **Check that it aligns.** Measured first:
   - `motion.py check`: length, the hand within 12 cm of its target at its frame, feet not sliding while planted
   - the shot review: pictures at the clip's start, middle and end and at the grab frame, from the player's eye
     (is she in frame, is the hand on the collar, is she inside a wall)
   - then by eye on the contact sheet
5. If it fails: a better prompt, a tighter constraint (a mid-pose keyframe, more waypoints), or split the motion
   into two prompts on the timeline, then regenerate.
6. You fine-tune the hero moments by hand (Control Rig in Sequencer). Everything else ships as generated.

**Reusable motions** (`motions` in story.json): idles per cast member, walks, sits, a few gestures. Generated
once, they loop while a scene holds or a stand-in waits. **Looping in Kimodo's demo:** tick **Loop** (Constraints panel)
and the first Full-Body keyframe is repeated at the last frame when you generate (or save the constraints), moved
along the 2D root path, in place without one; a keyframe you put on the last frame yourself wins. The last frame is
then the first one again: play frames 0 to N-1 so the wrap doesn't hold a frame, and blend the last 0.3 s into the
start if the direction turns at the seam.

Epic's free Game Animation Sample covers the player and ordinary locomotion.

**The studio's additions to Kimodo's demo.** They live in `setup/kimodo_studio.patch` (its first line names the
Kimodo commit it was made on), which `setup.py kimodo` puts in after the clone. By hand:
`python setup/setup.py kimodo-patch check | apply | remove | refresh`. `refresh` saves the checkout's changes (new
files too) back into the patch: run it after changing the demo, then commit. A newer Kimodo gets the patch by a
three-way merge; if that conflicts, the checkout is left as it was and you either build the Kimodo it was made on
(`setup.py kimodo --rev <that commit>`) or port it with this map. Everything that isn't a hook into Kimodo's own code
is in `kimodo/demo/studio.py` and `kimodo/demo/studio_web/` (the pose window), so a port is mostly re-adding hooks:
- **Loop** (Constraints panel), above. On a path that turns, the copy turns with it (the path's heading at its end
  against its start, about the hips), so a loop around a corner arrives facing the new way. Code: `generation.loop_first_pose`, called by `compute_model_constraints_lst` for
  the Full-Body track when the checkbox sets `session.loop_first_pose`.
- **In place** (Exports, Motion; Save Motion uses it too): the root's travel taken out, its sway and bob kept, so a walk
  plays on the spot for an NPC or player rig. The travel is the root's path smoothed over 0.25 s and pinned at both
  ends, so an in-place Loop still ends exactly where it starts. **Drop last frame** (Exports): a Loop's last frame
  repeats its first; drop it and the wrap doesn't hold a frame. **Mirror** (Exports): left and right swapped across
  the plane the character starts in, a left-handed copy for NPC variety; rotations are corrected for rest frames that
  aren't mirror images, so they agree with the mirrored positions to under half a centimetre. Hook: `ui.save_motion` and the Download button export
  `studio.for_export(motion, ...)` instead of the motion.
- **Stage** (its own panel): a story's rooms as see-through boxes around the character, to plan a motion in the room
  it plays in. `python tools/kimodo.py stage --game G --at <spot>` writes it (`Saved/Kimodo/stage.json`, the panel's
  default): the floors, walls, doors (orange), furniture (blue; green if it's used), and the marks (red ones are the
  player's, with a sphere at eye height), placed so the character starts on `--at` facing its way. It's scaled by
  Kimodo's body height over the cast member's (`--who`, or the one named in the spot, or the only one), so after the
  retarget onto them a hand on a door handle stays on it. `--rooms a,b` or `--level` for more than the spot's room and
  its neighbours; Move X, Move Z and Turn shift it in the viewer. **Player's Eye**: the camera at a player mark's
  eye (View From), the game's lens (`game.fov`, 90 degrees across), looking at the character's head and following it
  as it plays (Keep Aiming); Free Camera puts your view back. **Door swings**: each door's leaf sweeps an orange arc
  on the floor, into its room for `swing: in`, away for `out`; the format has no hinge side yet, so the arc hinges on
  the leaf's left end. Code: `studio.load_stage` and friends, `ui.aim_eye`.
- **Path** (its own panel): tick **Draw Path** (or press **P**), click the floor to add a waypoint, click a waypoint to
  remove it. Each lands on the 2D Root track (the start at frame 0), timed by **Pace** (even over the clip, or sneak,
  walk, jog, run speeds); changing the pace retimes them; a waypoint deleted on the timeline leaves the path. The camera
  can't orbit while drawing (viser's click mode), so P toggles it. Code: `studio.floor_hit`, `studio.pace_frames`,
  `ui.path_sync`.
- **Pose** (its own panel): **Pose…** opens a window (an iframe in a modal, served by `studio.PoseBridge` on port 7861)
  with an OpenPose-style figure over Kimodo's full skeleton, starting from the playhead's pose (or the armed one), the
  stage around it. Drag the hand and foot dots (two-bone IK; elbows and knees steer the bend), the hips (Pin feet keeps
  the feet planted: crouch, kneel, lie down), the neck (bends the spine) and the top of the head (tilts the neck);
  click a hand, a foot or the head (no drag) for three rings, twist and two bends, and drag one to turn it;
  orbit, pan, zoom; Load frame, Reset, Undo, Mirror, Turn. Hold **Shift** while dragging a hand or a foot and it
  sticks to the stage surface under the pointer (2.5 cm off it: a palm on a door, a foot on a step). **Poses ▾** is the library shared with the desk
  (`tools/kimodo_poses.py`): Load puts a pose where and facing the way the figure is (desk poses through
  kimodo_constrain's solver); Save writes it exactly into `Content/Studio/kimodo_poses.json` and a previs copy
  (bone directions matched) into `poses.json`, so the desk can block with it; a desk pose's name isn't overwritten.
  `python tools/kimodo.py py -P tools/kimodo_poses.py check` compares every saved pose with its desk copy. **Arm** closes it, and from then on a click on the
  Full-Body track drops that pose instead of the generated one (Ctrl+drag holds it over a range) until **Disarm**;
  **Drop at playhead** places it once. The window works in rotations relative to each parent's global one, so the
  pose round-trips exactly (`studio.effective_locals`, `studio.pose_fk`). Hook: `ui.add_constraint_callback` uses
  `session.armed_pose` for Full-Body.
- **The scorecard** (under Generate): after each generation, every take's feet sliding (cm while planted), its worst
  constraint miss (cm), and with Loop its seam (the pose gap and the speed jump at the wrap); ★ marks the best. With
  Num Samples above 1, click a character to keep that take. Code: `studio.take_report`.
- **Preset** (Generate): horror prompts in Kimodo's style from `Content/Studio/kimodo_prompts.json`, each with its
  length and what it should do (`expect`). `python tools/kimodo_presets.py run` generates 3 takes of each and
  `check` measures them (forward travel, hips height, hands near the head, how far the body turned) and writes the
  result into the preset, which the dropdown shows: PRESETS ok when every preset makes 2 of 3. Measured so far:
  all 12 pass (11 of them 3 of 3). What the words can't do goes in the preset's `tip`: Kimodo won't crouch-walk
  from any wording tried (stalk: arm the crouch pose instead), and it backs away at walking pace however slowly it's
  asked (draw a Path at Sneak pace).
- **A Kimodo fix:** Make Smooth Path with no 2D Root waypoints no longer crashes generation.
- **Send to Studio** (Exports): Game, Name and Clip, then Send: the motion as exported (In place, Drop last frame)
  goes through `motion.py import` into `Content/Games/<Game>/Motion/<Name>.json`, and the clip (every version of
  it) plays it, so the desk shows it on the real body in the blocking at once.
- Or by hand: Download as NPZ, then `python tools/motion.py --game G import <file.npz> <name> [--clip
  <scene>:<clip>]` writes the director file (`Motion/<name>.json`) and points the clip's `body.file` at it, so the
  desk plays it on the real body in the blocking.

## 1a. The shot list: making the motions in the demo (format 3)

Each clip's body lists its Kimodo **segments** (STORY_FORMAT §9.5): one behaviour each, 2 to 10 s, named by
`<game>_<scene>_<clip>_<nn>_<verb>`. The desk's **Kimodo** page (`tools/director/kimodo.html`, or
`python tools/motion.py --game G shotlist`) lists every one, scene by scene: the prompt, the length in seconds and
frames, the constraints (the root path in metres ahead and left of where the motion starts, with a top-down sketch
and where the player stands; the full-body keys; Loop), the save path, and whether it's made. You make them in the
demo (`python tools/kimodo.py demo`) and save each as NPZ under its name; **Import** (or `motion.py import`) turns
them into director files on their segments. The desk chains a clip's segments: each starts where the last one
ended, turned to its facing, blending in over 0.25 s, and the clip's `fit` stretches the chain to the take.

## 1b. Kimodo's motions onto your MetaHumans (`tools/retarget.py`)

Kimodo makes its motions on its own 77-joint skeleton (SOMA). Unreal moves them onto a MetaHuman by **retargeting**:
an IK Rig on each skeleton (named chains: spine, neck, head, arms, legs, fingers) and an IK Retargeter between them
that copies each chain's motion and lets IK keep the feet planted and the hands on target, whatever the body's
proportions. It's set up once; then every motion goes onto every MetaHuman in a batch.

1. `python tools/retarget.py setup` (once): Blender's Python module (bpy 4.2, a tool we run, nothing of it ships).
2. `python tools/retarget.py --game G fbx`: each motion in `Saved/Story/G/motion/*.npz` -> BVH (Kimodo's
   `kimodo_convert`, standard T-pose) -> `fbx/<job>.fbx` in centimetres, plus `fbx/SK_SOMA.fbx` once (Kimodo's
   skinned body in that T-pose: Unreal makes a Skeleton only from a mesh). Each FBX is read back and every joint
   compared with the NPZ (0.00 cm in the test, a walk with a wave and a twist).
3. `python tools/retarget.py --game G unreal [--cast mari] [--body /Game/.../SKM_Body]` writes
   `Saved/Story/G/retarget_unreal.py`; run it in the editor (UnrealClaude `unreal_execute_script`). It imports
   SK_SOMA to `/Game/Studio/Kimodo` and the motions to `/Game/Games/G/Motion/Kimodo`; makes `IK_SOMA` (the editor's
   auto chains and full-body IK) and `RTG_SOMA_to_MetaHuman` (target: Epic's MetaHuman IK Rig; chains auto-mapped,
   SOMA's T-pose aligned to MetaHuman's A-pose); then retargets every motion onto each rigged MetaHuman's body into
   `/Game/Games/G/Motion/MetaHuman/<cast id>/`. Your MetaHumans share one body skeleton, so any of them can play any
   result; one pass per body keeps the feet and hands right for that body.
4. Look at a few on the character (feet sliding, hands crossing the body): fix it once in the retargeter (the IK
   goals, a chain's settings) and rerun step 3.

The talking stays apart: faces come from the takes (§2) and play on the face while the body plays the retargeted
motion. Contacts that must be exact (the grab) are the runtime IK's job (§4), not the retarget's.

## 2. Faces: MetaHuman Animator (yours)

- The takes come back named by take id (`intake.py`). Claude imports the voices and queues the face videos.
- **Mono video:** Live Link Hub → Capture Manager → Mono Video Ingest → a MetaHuman Performance per take →
  solve → bake to the face.
- **Audio-driven:** from the voice alone; head movement and emotion are adjustable.
- The pilot's face test (SETUP S12) decides which is the default. Close-ups may want video, voices from the dark
  are fine with audio.
- **Body and face are separate tracks** on a MetaHuman: Kimodo drives the body, MetaHuman Animator the face. They
  meet in the scene's sequence by take id, so either can be redone alone.
- **Generated video's weak spot is temporal jitter** (frames that morph). Bookend frames help the seams; for jitter,
  solve at a slightly lower smoothing threshold, and keep close-ups short (a clip is 10 s or less anyway).

## 3. MetaHumans

**Design the body first, in the desk (the Shape page):** every cast member starts as Meta's **MHR** body
(`Content/Studio/Bodies/MHR.fbx`, Apache-2.0, so it ships): 45 identity sliders (20 body, 20 head, 5 hands), each
labelled by what it measurably changes, plus "fit to widths" (shoulders, waist, hips in cm). Save writes the cast
member's `shape` and `height`; the storyboard and Watch then play the blocking on that exact body. **Export OBJ (A)**
writes `Content/Games/<Game>/Characters/<cast>_body_A.obj`: the shaped body at the cast member's height, in cm, a
closed welded mesh (from MHR's finer LOD 2, about 21k triangles), in MHR's A-pose (and **Export OBJ (T)** the same in
T-pose).

**Then make the MetaHuman from it:** import the OBJ as a Static Mesh and use the body conform in the MetaHuman
Character editor (Creator is inside the editor since 5.6). Since 5.7 it accepts a source anywhere between A-pose and
T-pose (best in the MetaHuman A-pose: export A), and Epic's custom-character docs say the mesh needn't be MetaHuman
topology; the conform fits MetaHuman's own mesh to yours, so the result is a normal rigged MetaHuman. If it struggles
with MHR's mesh, the fallback is Epic's **MetaHuman Conform Topology** pack (Fab): wrap its archetype body onto the
MHR export (Blender or Wrap), then conform to that. Then do the fine work in Creator: face, skin, hair. Not tried yet:
the first time (SETUP S12), write what worked in LESSONS.md.

**The route, decided 2026-10-20: docs/METAHUMAN_ROUTE.md** (the desk designs, MetaHuman Creator's Python API makes
and rigs, the rigged body comes back as the previs body, Kawaii Physics for the jiggle). Below, the earlier notes.

**Faces in MetaHuman, bodies from the desk (the blend):** a MetaHuman is a head and a body, and Creator works on
them separately. So the face is made there: sculpted from its presets, or from a head mesh sculpted elsewhere
(Blender, ZBrush) through Mesh to MetaHuman. The body is conformed to the desk's export: the Shape page's OBJ for a
slider body, the Fat suit page's **Export OBJ** for a sculpted one (the hourglass). MetaHuman joins the two at the neck.
The desk's MHR head sliders (20) give real-scan variation at low resolution (head width, skull, jaw, nose, crown); a
styled face (large eyes, a small nose and jaw, make-up, hair) is Creator's work. Stylisation is limited to what the
MetaHuman face rig can carry: for a heavier stylised look, sculpt the head first and bring it in through Mesh to
MetaHuman. The desk keeps its MHR head for previs.

- One per cast member, rigged once (the cloud auto-rig; it only sees the character).
- Clothes are fitted after rigging (the wardrobe or custom garments weighted to the skeleton).
- Damage and dirt are texture variants, not new rigs.
- `cast.<id>.metahuman` points at the Blueprint; the importer's stand-ins give way to it.
- Monsters are rigged locally in Blender, not as MetaHumans.

## 3a. Soft tissue and clothing

- **Clothing:** MetaHuman Creator (in the editor since 5.6) has a wardrobe of parametric outfits that resize to the
  body you made, and Fab sells more in the same format (`.mhpkg`); garments of your own (Marvelous Designer, Blender)
  come in as outfit assets, simulated with Chaos Cloth. Rig the body first, then dress it (as we said for rigging).
  The desk's MHR bodies stay unclothed: clothing is for Unreal.
- **Soft tissue (jiggle), tied to the body sliders:** physics runs at runtime on top of whatever animation plays
  (Kimodo, mocap, hand keys), so it never has to be baked into the animations, and every animation gets it. The plan:
  1. a **softness map** per character from its MHR shape: the vertices the shape moved most outward (belly, chest,
     hips, thighs, upper arms) are the soft ones, and its amplitude scales with how far the sliders went;
  2. in Unreal, a **Deformer Graph** jiggle deformer on the MetaHuman body (springs per vertex, weighted by that map,
     transferred by closest point onto the MetaHuman mesh, which was conformed to the MHR body); no new bones, no
     reskinning. Heavier alternatives: jiggle bones with Kawaii Physics (needs bones added and painted), or Epic's
     Chaos Flesh trained into an ML Deformer (cinema quality, a lot of setup);
  3. the same map can drive a preview jiggle in the desk later.
  Built since as an experiment: docs/FLESH.md. Its default is soft bones (spring chains per region, the Kawaii
  Physics way), which look right, collide with the world and export bones and weights for Kawaii (§5).
  In first-person horror it shows mostly on close, slow beats; it's a polish layer, after faces and voices.

## 4. The grab: hybrid IK and partial physics (built once, SETUP S11)

The parts are all stock Unreal:
- **IK:** the actor's arm goes through IK (Control Rig two-bone IK, or Full Body IK for the spine too). Its target
  is a socket on the player's camera rig (`GrabSocket`, at collar height).
  - It blends in from the body animation over 0.15 s around the grab frame (the frame Kimodo was pinned to, so the
    hand is already there).
  - It blends out on release.
- **Physical animation:** a Physical Animation Component on the actor's upper body (spine, arms, head), with
  strength in proportion to the player's pull, and a hit-reaction profile for the stumble. The legs stay animated,
  so she staggers rather than collapses.
- **The player:**
  - movement locked (camera `held`)
  - each press (E, Space or the left button) adds to a 0..1 "pull" value (about `need` × 20 presses fill it), with
    decay so she drags them back if they stop; the camera pulls in the `pull` direction
  - the camera leans with the pull; a small shake
  - the pull value drives her physics blend and a lean additive
- **The outcome** (the clip's `event` of type `struggle`):
  - past `need` within `secs`: release IK, a stumble animation chosen by pull direction (back, left, right), the
    physics blend peaks, then recovers to her idle; `escape`
  - otherwise: a `caught` animation, a fade
  - the flow's result choice takes it from there
- **Debug:** `Story.Struggle <need>` replays the last grab, and the debug HUD shows the pull value.

Generated bodies stop at the grab frame, and IK plus physics carry the rest. Every grab in every game reuses it,
with different numbers.
