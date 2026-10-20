# Decisions

The user's answers, newest first. They override the plan, the research and the docs.

## 2026-10-20 (pipeline v2: the user's answers)

- **Endings are good, neutral and bad**; "evil" is the bad one. **Easter eggs** aren't karma: they come from what the
  player found and blend back into the main story.
- **The MiniMax prompt** is `she makes a <expression> while she <voice> <d>[Japanese] <line> </d>` (`[Japanese]`
  written literally). Claude supplies the expression and the voice; the user handles the rest of MiniMax's format.
- **Voices:** try more than says, whispers, says angrily and screams; keep a list of what's been tested and works
  (docs/VOICES.md).
- **The blocking loader into Kimodo's demo and the Loop tool are the user's** (built locally): nothing to build here.
- "Work on it until you can't do anything else without me": the branch builds everything that can be built and
  checked without the editor, the RTX 3090 or the user's takes.

## 2026-10-20 (pipeline v2: how a game is made from now on)

- **The workflow** (docs/PIPELINE.md v2, built on branch `pipeline-v2` by docs/PIPELINE_V2_PLAN.md):
  1. The user's outline and rough cast in the desk.
  2. A local model drafts the English script; Claude reviews and glues.
  3. The user refines.
  4. Claude's Japanese pass (as a professional film would say it), with English and Chinese subtitles translated
     from the Japanese, and a MiniMax image-to-video prompt per take.
  5. The takes on the desk's timeline, with an auto-clean that fits the director's parts to them.
  6. The motions made by the user in Kimodo's demo from Claude's shot list, imported back by name.
  7. Unreal: the blocked game playable, the MetaHumans, the face mocap, the gameplay with a crosshair.
  8. Art, QA, ship. The engine and its mechanics are versioned so each game is quicker than the last.
- **The kind of game:** a dark anthology in first person (Resident Evil 7 meets Japanese monster and psychological
  horror), carried by mood. The ending comes from **karma**: how the player responded and reacted, in timed choices
  (30 s), not what they found. **No dying**: a missed task guides the player gently on; only the final ending may
  kill the hero. Branching and simple acting scenes after *Five Hearts Under One Roof*.
- **Takes are 7 to 8 seconds** (MiniMax's audio holds for 7 to 9): the Japanese is written in beats that stitch (a
  line, a pause or an expression, a short question). `clip_max` 8.
- **Motions:** 80% simple life-to-life, 15% activity, 5% action and horror, a few detailed ones and the final
  ending's; the detail comes from the face mocap. Each Kimodo motion is one behaviour of at least 2 seconds
  (docs/KIMODO.md). The head's look is a layer on top (trackers, clamped), not Kimodo's job.
- **The first game is a 15 to 20 minute itch.io game**, to test every stage once.
- **Extras:** a procedural idle so characters stay alive outside the interactive parts; a script generator on a
  local model (Qwen3.6-27B on the RTX 3090) with Claude for the reviews and the glue.
- The work runs on its own branch beside SETUP (which continues on the user's machine).

## 2026-10-20 (Kimodo's motions onto the MetaHumans)

- **The body motions made with Kimodo in the desk go onto the user's rigged MetaHumans in Unreal** (no talking: the
  faces come from the takes). Unreal's IK Retargeter does it: Kimodo's SOMA skeleton and its skinned body as FBX,
  one IK Rig and one retargeter to MetaHuman made once, then every motion batch-retargeted onto each MetaHuman's
  body by a generated script (`tools/retarget.py`, docs/ANIMATION.md §1b). The FBX side is tested exact; the editor
  side is the first run's job (SETUP S12).

## 2026-10-20 (clothing: generated, live physics)

- **Clothing is made on the go and its physics stays live:** garments as GarmentCode programs sized by the cast
  member's measures, into Unreal's Outfit Asset (Chaos Cloth, parametric resizing) through a template Dataflow
  graph; simulated at runtime, so a body change is a re-evaluation, not a rebake; ML Cloth is the optional bake,
  scripted (docs/METAHUMAN_ROUTE.md §6). `tools/garment.py` makes the pattern and the placed panels (tested on
  Mari's t-shirt); the Unreal import is the first run's job.

## 2026-10-20 (the MetaHuman route: design here, make it there)

- **We don't compete with MetaHuman; the desk edits MetaHumans.** A body is designed in the desk (the Shape page,
  the Lines tool, a skin tone) and sent to MetaHuman Creator as *numbers* through its 5.8 Python API (parametric
  body constraints, skin settings, auto-rig, assembly), not as a mesh; only a shape the parametric model can't make
  goes as a conform from the desk's OBJ. The rigged body comes back as the desk's previs body (no face rig in the
  desk). Jiggle is Kawaii Physics on the MetaHuman body, set up from the Fat suit page's export; the sculpt tools are
  not ported into Unreal (docs/METAHUMAN_ROUTE.md). `tools/metahuman.py` writes the editor script; untested until the
  user runs it (SETUP S12).

## 2026-10-20 (sculpting lines)

- **Sculpt the fat suit by its silhouette:** vertical lines over every soft part with points to pull in or out,
  proportional editing with a scroll-set radius, cut to add points, grouped by part; only the fat suit moves, never
  inside the lean body (docs/FLESH.md §5, the Lines tool).

## 2026-10-20 (breast shape: shelved)

- **The teardrop shape is shelved:** the desk's mesh has too few points across a breast for a real crease and
  underside (three ways tried, docs/FLESH.md §5). The round volumes stay; the shape comes from MetaHuman and the
  jiggle from Kawaii Physics, set up as a ball in fat: a stiff core bone and a loose fat bone.

## 2026-10-20 (the refiner, jiggle by area, more vertices)

- **Edit the fat suit by hand:** a transparent brush (like the creator's paint tool) paints volume (stronger or
  weaker) and jiggle; per-area jiggle amounts (bust, butt, thighs, belly, arms) take any value, absurd ones too, for
  testing.
- **More vertices for round volumes:** MHR's LOD 1 and LOD 0 (73,639 vertices) are selectable on the page. LOD 0
  makes the volumes round like water balloons; LOD 2 stays the default for speed in the browser.

## 2026-10-20 (jiggle slider, the hourglass, faces)

- **A jiggliness slider**, the soft-bone presets as its medium.
- **A slightly chubby hourglass** to see a run cycle: MHR's sliders plus sculpted volumes and a cinched waist
  (docs/FLESH.md §5); exportable as an OBJ for MetaHuman's body conform.
- **Faces come from MetaHuman, bodies from the desk:** a MetaHuman character is a head and a body conformed
  separately, so the head is made in MetaHuman Creator (or from a sculpted head through Mesh to MetaHuman) and the
  body comes from the desk's export (docs/ANIMATION.md §3).

## 2026-10-20 (soft bones: look right, touch things)

- **Jiggle should look right, not simulate tissue:** breasts move like a water balloon, as one object; per-point
  springs contorted. Soft regions are now short spring chains the mesh is skinned to, after EZSoftBone (Unity, MIT;
  Unreal's Kawaii Physics works the same way), and they collide with the world (floor, walls, boxes, balls) and the
  arms (docs/FLESH.md §5).
- **Spread:** a touch or a swing bends the whole mound and the skin around it; the body under and around the fat
  takes a share that grows with the fat's depth, most for breasts and buttocks.

## 2026-10-20 (water balloons on a flat base)

- **Breasts and buttocks as volumes:** a flat base body (Mari, chest and backside solved flat) with the breasts and
  buttocks added as water-balloon volumes in litres, to study how they move (docs/FLESH.md §4). For realism, on a
  featureless mannequin with technical cameras; nothing sexualised.

## 2026-10-20 (the fat suit experiment)

- **Jiggle and sag from body fat:** a character is a lean body wearing a fat suit (the same MHR mesh solved lean);
  the gap is the fat's thickness, and mass, stiffness, ringing, sag and support all follow from it (docs/FLESH.md,
  the desk's Fat suit page). An experiment first; the desk and Unreal later.

## 2026-10-20 (no clipping, IK, squash; procedural animation later)

- **Bodies mustn't clip through themselves:** a hybrid layer over the animation (FK from the motion, IK for reaches
  and collisions), with collision shapes from each character's own body, so a heavier character's arms rest wider.
  Plus contact squash. The hips leaning back was a retarget bug (fixed: the trunk turns from its rest, not by aiming).
- **Later, on local Claude:** procedural animation from batches of generated variations (docs/PROCEDURAL.md): what
  stays the same becomes the core, what varies becomes controls, contacts are IK.

## 2026-10-20 (Kimodo from source, the whole MHR skeleton, late)

- **Kimodo is built from its repo with uv, not Docker:** Docker images go to the system drive; uv keeps Python, the
  packages and the models in one folder (`setup.py kimodo [--home DIR]`, default `vendor/kimodo`), with NVIDIA's
  pinned versions.
- **Drive the whole MHR skeleton:** fingers, toes, neck chain and twist bones, from Kimodo's 77-joint SOMA output;
  no face (that's MetaHuman Animator's job). The blocking goes to Kimodo as full-body keyframes so generated motion
  keeps the approved staging.

## 2026-10-20 (first-person framing, MHR bodies, night)

- **The player is the camera (Resident Evil style):** shot types are only what the player's own eye can see from
  where they can stand. A shot size is how close the actor comes (Hall's zones: CU is a face inside 0.55 m), never a
  lens: one field of view for the game, `push` is leaning in (0.35 m at most), `zoom` at most 15 % for a held focus,
  the eye at the stance's height (`stance`), looks within the neck (75°), view spots only where a player can stand.
  The desk, `story_check` and the shot review enforce it; the pilot was restaged (Mari steps up to whisper).
- **MHR instead of the basic figure:** Meta's Momentum Human Rig (Apache-2.0, so it ships) is the desk's default
  body, with a **body shape editor** (the Shape page: 45 identity sliders, fit to widths) so characters are designed
  in the desk; their `shape` plays in the storyboard and exports (OBJ, closed, at height) as the base for a
  MetaHuman's mesh conform, where the fine detail is done.

## 2026-10-20 (bodies and the CC0 library, evening)

- **A more real body in the desk:** the storyboard plays the blocking on a real rigged human when one is in
  `Content/Studio/Bodies/` (Manny or Quinn exported from the project, a Mixamo character, each cast member's MetaHuman
  body), found by bone names, A-pose or T-pose, scaled to the cast member. Those files are licensed for our use, not
  for sharing: they stay local and never go in a zip. The capsule figure stays as the fallback.
- **The awesome-cc0 list is part of the studio** (`docs/assets/awesome-cc0.md`), for Claude to texture and replace
  textures later: a shared CC0 library (`Content/Studio/Library/`), story fields to use it (`shape: asset`, `art`,
  `mat`, a room's `look`), `tools/cc0.py` to find, fetch and record, the desk and the importer to show it
  (docs/ASSETS.md). The Base Mesh's 900 props are indexed by name and size; ambientCG is fetched by the tool; Poly
  Haven by hand (its API's terms want a licence for commercial use, though the assets are CC0).

## 2026-10-20 (the director, later that day)

- **The director's desk is where the game is made first:** start a new game there, plot it, block every body and
  shot, and watch it as the finished storyboard. Fix it there before Unreal. Claude in Unreal builds to the desk's
  storyboard and blocking.
- **Cutscenes can't be skipped** (that's how the 2-hour minimum holds); timed events can be done faster, so the
  player feels they have a choice (The Dark Pictures, Resident Evil Village). The checks count both.
- **Trigger cutscenes:** taking something you shouldn't can end the game (Alien Isolation).
- **Bodies play in sequence in the desk with blends between them,** judged only by what the player can see (feet
  behind a table don't matter). There's a fixer for mismatches: extend, hold, loop, pad, or an in-between.
- **Easing modifiers for jumpscares** and other moves text-to-motion handles badly (snap, hold, twitch, ease).

## 2026-10-20 (the studio)

- **One project for every game** (no new project per game: shaders and setup take too long). Each game is a
  folder; packaging takes only one game's maps and the assets they use (docs/STUDIO.md).
- **Claude's editor assistant is UnrealClaude** (github.com/Natfii/UnrealClaude), with the UE 5.8 compile fix from
  its pull request 48 merged in.
- **Spine first:** block the story scenes with the MetaHuman actors first; once they flow, stitch the player's
  tasks between them (docs/PIPELINE.md).
- **Branching is allowed:** good, bad and secret endings, easter eggs, occasional branching scenes that rejoin the
  main story; several prototype versions (variants) of one moment to choose between.
- **Timing must be elastic:** a longer take mustn't break the prototyped flow.
- **A director's desk** (an HTML app, the user and Claude both use it) to plot everything first and pass ideas back
  and forth with notes; the game is then built to match it.
- **The order of polish:** the user replaces stand-ins with MetaHumans, then faces (mocap from the takes), then
  bodies.
- **Takes are limited to 10 s per clip:** seams get hidden with soft camera locks (a look cone with margins, forced
  look-aways), blinks and other horror-friendly tricks (docs/TRICKS.md).
- **A hybrid IK grab:** an actor grabs and pulls; the player can pull back with the mouse; she stumbles naturally
  (partial physics, not a full ragdoll).
- **Body animation from prompts:** NVIDIA's Kimodo (the user remembered "an NVIDIA tool"); Claude prompts and
  checks, the user does the face mocap and final touches (docs/ANIMATION.md).

## 2026-10-19 (the kit)

- **Engine:** Unreal Engine, the latest (5.8 or later: the official MCP plugin needs 5.8). The user installs it;
  the kit sets up the rest.
- **The games:** short first-person horror, 2 hours minimum (aim for 2.5 to 3, past Steam's refund window).
  Game one is linear and Amnesia-like (pick things up, learn, unfold a story), not choice-driven like the Dark
  Pictures anthology. Choices may come later.
- **The split:** the user writes rough stories, makes the MetaHumans, records the dialogue with MiniMax in
  **Japanese** (it sounds better; English subtitles) and generates close-up face videos. Claude refines the
  story, writes the script, blocks out and builds the game, makes the animations (text-to-motion API) and does
  the refinement.
- **Faces:** generated close-up video → facial mocap (MetaHuman Animator from mono video), instead of a webcam.
  Compare it with audio-driven animation in the pilot (SETUP S11).
- **Blockout:** blocks, spheres and T-pose stand-ins, replaced by art later. Cheap horror tricks hide the joins:
  forced looks at faces, look-aways while things change, sound, creaks.
- **Aim:** a game every 1 to 2 months, once the pipeline is built.
- **Review:** Claude reviews the game's frames from the player's eye, by measurable rules (clipping, framing,
  light on the subject, stand-ins in view) and film-directing sense, using the shot review in the dictionary.
- **Business:** Steam (30 % cut, $100 a game). Unreal's 5 % royalty applies only past $1M gross per product.
  Speak to an accountant about a limited company and VAT (UK).
