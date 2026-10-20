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
once, they loop while a scene holds or a stand-in waits. Epic's free Game Animation Sample covers the player and
ordinary locomotion.

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
  - the mouse drag in the `pull` direction is integrated into a 0..1 "pull" value, with decay so she drags them
    back if they stop
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
