# Decisions

The user's answers, newest first. They override the plan, the research and the docs.

## 2026-10-21 (Play mode: the look last, physics things, a cursor, CSS UI)

- **Unreal doesn't have to match the desk's look.** Post-processing and the look come last, per game (a game may go
  more romance than horror). The desk -> Unreal match is about layout, timing and blocking, not colour.
- **The Pilot is only the transfer test.** No more work on its story, notes or picks.
- **Things you can interact with have physics**, tested first with a large die: a roll can unlock an easter-egg scene
  or a side path that branches off and **rejoins the main line later**. The goal is a narrative with no hard cuts
  that flows naturally, where the player's choices fill in the gaps.
- **The in-game UI is made on the desk first** and may move to Unreal if we like it: no hands yet, so a **cursor that
  changes with what you're looking at**, styled **neumorphic** (buttons that pop out, as if the world were a touch
  screen you click). The styling stays **CSS**, themed per game, so a game can switch themes. Mini-games can grow
  out of the same style.
- Later, not now: the Unreal preview locks the camera; Play mode frees it.

## 2026-10-21 (gameplay: Resident Evil 7 feel, desk first)

- **Rough gameplay is made in the director's desk first** (a Play mode you walk through), then Unreal. The plan:
  docs/GAMEPLAY_PLAN.md; the next session starts there.
- **Never a hard cut:** gameplay, interactive cinematics (walk around while they talk), soft and full cinematics
  blend into each other; cinematics can still hold timed moments (choose A or B).
- **NPCs run simple behaviours, not AI:** idle, sit, walk a route, patrol by cycling set routes the story can change;
  talking to them gives a few lines (first time, again, a reminder of the task) or starts a scene or a choice.
  Routes can run in gameplay and in interactive cinematics. Mini-games later.
- **The first game needs crouch and hide:** hiding places whose door goes see-through by an amount set with a
  slider, safe zones where the player can't be spotted, patrols on predetermined routes.
- **Easy to extend:** every gameplay part is a small registered module (conditions, actions, behaviours,
  interactables, player abilities), so torches, the player's hands and more come later as new parts. The same
  system must serve a romance game.

## 2026-10-21 (Generate: the desk to Unreal with no Claude in between)

- **When the user is done on the desk they press Generate, and Unreal has a previewable game with no Claude in
  between.** Claude helps later, inside Unreal. The first goal: the newest Pilot, every block, piece of furniture
  and light, 1:1 in Unreal, and its scenes previewable.
- **No voices yet** (the dialogue voice tooling comes later): the MVP plays the scenes with subtitles only.
- **Gameplay is UI selectables for now,** as in the desk's Watch (task cards, results and choices as buttons); the
  real gameplay is refined later.
- `scene-builder` is merged into `main` (it changes the desk -> Unreal flow).

## 2026-10-21 (animation first, the dialogue fits the motion, and Claude asks)

- **The default order is the draft script, then the Kimodo motions, then the Japanese and English dialogue.** The user
  is not a native Japanese speaker, so they choreograph to the English draft and the lines are written afterwards to
  fit each motion's mood and length. The face and voice takes (MiniMax, then the face mocap) come last. Dialogue-first
  is still allowed for a scene where the line is the point.
- **Lines are written in increments of 7 seconds or less** (MiniMax gives up to 8 s of audio; 7 leaves padding), the
  way game voice actors deliver them: a beat at a time, never a whole speech in one go. Set `game.clip_max` to 7.
- **A motion that runs short is not stretched: the line is rewritten** (an action scene is short anyway). A motion
  that runs long gets a waiting loop (standing, waiting for a reply) that the user adds, which `fit: loop` / `hold`
  already carry.
- **No hard rules about order.** The pipeline is a menu of steps. At the start of a session Claude reads the notes and
  the story state, asks what the user is doing now, and does only that step. It does not move on by itself.

## 2026-10-21 (UnrealClaude's scripts)

- **Claude sees UnrealClaude's Python tools, and scripts in this project run without asking** (`--show-scripts
  --auto-approve`: `execute_script`, `cleanup_scripts`, `get_script_history` listed; `bAutoApproveScripts=True` in
  `Config/DefaultEditor.ini`; the editor logs each script). `run_console_command` stays hidden.

## 2026-10-21 (the studio runs on Linux)

- **Everything runs on the user's Omarchy machine** (Arch Linux, Hyprland, RTX 3090): Unreal 5.8.3's Linux prebuilt
  (stable at level 0, `../unreal-omarchy/docs/RESEARCH.md`), Kimodo, the desk. No Windows: setup.py, SETUP.md and the
  commands for the user are for Linux (bash, uv, Epic's bundled clang instead of Visual Studio). The `.uproject` goes
  in this repo's folder.
- **The project is `HorrorEngine`** (the user made it so), First Person C++, adopted into this folder. **Epic's
  template stays as the playable test level**, untouched and the start map, until the user says otherwise; it is never
  committed (the repo is public). First goals: Claude set up in the project (UnrealClaude), then the Pilot from the
  desk to Unreal as a 1:1 copy.

## 2026-10-21 (hair: Sisir for our own cuts, Fab for the rest)

- **Sisir is the tool to try for custom hairstyles** (free standalone, Windows: draw guides on the archetype groom
  head, a procedural stack grows the groom, Alembic out, bind in Unreal as a wardrobe item). Styles that exist on
  Fab are bought, not made (docs/METAHUMAN_LOOKS.md §3.3 and §3.5). The first Sisir-to-Unreal run goes in LESSONS.md.

## 2026-10-21 (music: the score room)

- **Woohill's music engine comes over as the score room** (`tools/score/`, docs/MUSIC.md), an HTML app now that can
  be plugged into the director later (no Godot tool). Its job: more horror-style piano and string orchestrations, and
  K-drama fun cues that score what the character is doing (typical K-drama TV: the sneak, the fall, the blush, the
  slow-motion look). It makes variations and the user chooses the favourites, which go into a palette per game (and a
  studio one). Built on research into K-drama and horror scoring and the shows and films whose music fits our
  instruments (docs/MUSIC_RESEARCH.md). Each game gets its own mini soundtrack, part procedural and reacting to what
  the player does, when it plugs into the desk and Unreal (docs/MUSIC.md §5).

## 2026-10-21 (horror romance, deaths back, the branch map, replies, simple gameplay)

These change the 2026-10-20 entries below where they disagree.
- **The player can die again** (no dying took the gameplay out). Instead of game over, **a death opens the branch
  map**: the player picks which branch to return to, and sees which branches they've missed. It works like
  *Five Hearts Under One Roof*'s scene and branch viewer (jump, skip, replay), **without its stat gates**. The
  desk works the same way.
- **The genre is horror romance:** obsession and yandere, as in Japanese anime and games (others may be prompted).
  First person is shaped by it: the intimate moments are written and staged for the player's eye.
- **Replies:** dialogue choices that mostly change the line she says back (left or right, the English with the
  Japanese over it, as the desk shows them). Each one can be just immersion (she answers, then the scene goes on with
  the line it was always going to say) or set something that opens a branch later.
- **Hanging lines:** she asks and waits, with her face, for the answer; not forever: past a few seconds her answer to
  your reply is skipped and the scene carries on with the next line it would have said anyway. The writing has to
  feel like a conversation even when the player's replies are the quiet guy's short ones: it has to feel like you.
- **Simple gameplay, for the Roblox generation:** hide or run, tick boxes, nothing that needs a hard decision or a
  hard puzzle. Hide and seek where being found is cute the first times and then not (found three times and it's
  over), chases, collect-while-she-patrols, sneak while she isn't looking. On the desk it's a card before the next
  scene ("did you manage to hide?"); in Unreal the built-in tools and Claude flesh it out.
- **Unreal later:** reverb that sounds like real houses and rooms, for immersion.
- **Later, not now:** lift the music tool from the woohill repo (live procedural orchestration) and make it part
  procedural per game: each game gets its chords, flourishes and a mini soundtrack that reacts to what the player does.

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
