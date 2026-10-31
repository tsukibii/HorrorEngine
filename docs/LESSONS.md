# Lessons

What each bug that took more than one try taught us: the rule, then the story in a line. Add one before pushing
the fix.

## Carried over from the Godot project (Woohill)

- **Measure, don't guess:** a check that prints one `<NAME> ok` line beats any amount of reading code. Every
  system gets one, and `tools/check_all.py` runs them all.
- **Keep context small:** summaries and tails, not whole files and logs. Contact sheets, not frames.
- **Small steps, pushed:** the user changes course quickly, so every step should stand on its own.

## This project

- **Read a generator's own controls before blaming its look:** TAU's lashes "stood up" because its Straight preset says
  so (Angle Inner 80°, Angle Outer 70°, off the lid's line: every other preset sweeps out at 40° to 10°), and a tidy that
  turned lashes up to keep them off the eye made it worse. Second try: the brows and lashes by hand, their angles
  measured on the user's references (the middle lashes 1.5 to 2.5 mm over the lid, not 3.7).
- **A hair's look is its thickness as much as its texture:** the editor's first lashes and brows were drawn the same way
  as TAU's but 30 to 50% thinner, and in Godot they faded to a faint line; at TAU's 0.055 mm they read as TAU's did.
- **A name in a 3000-line page is shared:** the editor's handle list was called `GH`, as the garments' handles already
  were, and the whole page stopped with "Identifier 'GH' has already been declared"; grep a name before taking it.

- **Move a cut mesh by the points its corners are made of, never corner by corner:** the Studio's export cuts the eyes'
  openings out of the skin by splitting MHR's triangles, and a split triangle's corner lies on its neighbour's edge (a
  T-junction). Any move that isn't the same blend of the same points (pushing each corner off the eyeball, closing the
  lids by moving the edge corners) opened cracks there, and the eye showed through them. The blink's targets are made
  from MHR's points (kept off the eye, the lids met by moving the edge corners' triangles' points) and the corners
  follow by their weights. Second try: the first shut lid had a cracked inner corner and a patch dipping into the cornea.
- **A morph target is a straight line; check the way, not just the ends:** the shut lid sat outside the eye and so did
  the open one, and halfway down the straight line between them ran 0.7 mm into the cornea (most where the lid crosses
  it, 60 to 90% shut). One corrective at the middle didn't cover it; in-betweens an eighth apart (and a sixteenth before
  the end) do. EYELIDS draws the file at every twentieth of the blink from five sides.
- **MHR's shut lids don't shut:** they leave 15 to 20% of the opening (the Studio hides it by shrinking its cut). A file
  whose opening is cut out of the skin showed the eye through a slit with the lids "closed"; the export meets the
  cut's edges over the blink's last quarter.
- **Pin a strand to the face it will be worn on:** TAU grew the lashes on the export, whose lids are brought forward
  onto the eyeballs (up to 4 mm); pinned there and rebuilt on the Studio's own face (not brought forward), each lash
  turned with its triangle's tilt and a fifth of them crossed the eye. Now each strand is moved back off the lift (the
  Studio's `body.bin`), pinned, and the export lifts it again with the lids (`liftWith`); our own lashes had stayed
  behind the export's lids too.
- **Copying a plugin over an imported Godot project leaves stale textures:** the skin came out striped like wood until
  the project was made fresh. The checks always build their project from nothing; a scratch script must too.

- **A headless test waits on the game's clock, not the wall's:** on slow frames (the cloud's software GPU) the
  runtime clamps each step, so a second of real time is less play; fixed `waitForTimeout`s raced every walk, sit,
  turn and meter. `gameWait`/`hold` in playtest.js wait for `rt.clock` (and stop when play ends: a walk that answers
  a choice ends play). Upper bounds can be generous; they only cost time when something is broken. PLAY failed at
  step 4 for a whole session before this was found.
- **A click in a headless test lands where the mouse last was:** Playwright's `page.click(selector)` moves the mouse
  to that element, so a mouse parked over the view before the Watch's Start button was clicked was over the button,
  and the game never saw the click (PLAY's first try of a left click to use). Park it again right before pressing, with
  the faked pointer lock let go for that moment: a locked mouse that moves turns the view (`click()` in playtest.js).
  And a check of someone walking measures the game's clock too (`onRoute`: Mari moved 0.18 m in 4 wall seconds).
- **A renamed room takes its built pieces' names with it:** the scene builder renames a borrowed level's rooms that clash
  (`genkan` → `genkan_2`), but the pieces it keeps as props (`genkan_fx_floor`, its built-ins, a cushion `on` its sofa)
  kept the old names, so a level taken twice into one game (a set borrowed where its layout already was) had every
  fixture twice and wouldn't plan. `renameItems` renames them and the `on`s; BUILDER borrows a set into such a game.
- **A test's search must not touch the story:** `goTo` tried 16 spots and ticked the game at each, so a spot on the
  cellar stairs fired `enter` and answered a choice. Aim-test a candidate without a tick, and skip spots inside a
  trigger the player isn't already in.
- **Two of the same element is a test's trap:** the Watch's footer and Play's HUD both have a `.ph-line`; a bare
  selector read the wrong one (and found a real bug: a triggered scene's last line stayed up in play). Read the
  runtime's own element (`rt.hud.lineEl`).

- **A box of absolutely placed cards has no height of its own:** the branch map's cards sat in a zero-height box and
  the page took the clicks; size the box to the cards (the map does now).
- **Merge the other session's push before building on the same file:** the local session's `motion.py import` (one
  file) landed on main while this branch had its own (every shot-list name); both forms now live under one command.
- **Playwright's own Chromium can't decode H.264 or AAC:** the desk's take test read nothing from a MiniMax-style
  mp4 until it used a WebM copy. Test takes with WebM; your Chrome or Edge plays the real mp4s.
- **A running desk server keeps the old serve.py:** new routes 404 until it's restarted (find its PID in one
  command, kill it in the next, start it again).
- **A dev skip mustn't skip the thing being tested:** the desk's Esc skip jumped past timed choices, so the karma
  test saw none; it now jumps to the next event instead.
- **A room with no doorway in had its entrance shot from its middle, looking straight down:** the planner now stands
  at the level's start spot (or just inside the south wall), so a new game's template passes the shot check.
- **Blender joins bones when it reads an FBX, and a joined bone can't move:** the first round-trip check of a
  Kimodo FBX was off by the whole walk, because the hips' travel was dropped on Blender's re-import, not in the file.
  Disconnect the bones before measuring (Unreal has no such rule).
- **Kimodo's skin is bound in an A-pose; its motions rest in a T-pose:** the first SK_SOMA put the A-pose mesh on the
  T-pose skeleton (64 cm apart at the hands). Kimodo's own skinning with identity local rotations puts the mesh in
  the T-pose first (`retarget.py` TPOSE). Its `from_standard_tpose` is the other way (to the BONES-SEED rest).
- **A Blender FBX in metres can say UnitScaleFactor 100 even with "FBX All":** for Unreal's own kind (centimetre
  values, factor 1) keep the scene unit at 0.01 m, import the centimetre BVH at scale 1, and export with
  `FBX_SCALE_NONE`. Read the header to be sure (`fbx_unit_scale`).
- **Walls are centred on the room edge (0.1 m thick):** a prop against a wall sits d/2 + 0.05 m from the edge.
  The pilot's bookshelf was 2 cm into the study wall until level_check caught it.
- **The greedy playthrough walks from where the player is, not from the level's start:** the first version
  locked the player out after the front door slammed behind them.
- **A greedy check finds secrets every time:** sweep the paths twice, once missing every `secret` beat and once
  finding them all, or the endings that need a secret missed are never reached.
- **The player keeps playing at an act choice:** use the key, read the note. The first check stopped the player at
  the choice with the key in hand and the door still locked, so only "hide" was possible.
- **Never kill by a pattern that the same command line contains:** `pkill -f`/`pgrep -f` match your own shell
  when the pattern (or the command that started the server) is in it. It happened twice. Start a server in one
  command, note its PID (`ps aux | grep "[s]erve.py"` in a separate command), and `kill <pid>` in another.
- **Ids made per scene must say which scene:** two staged stand-ins both called `cast_mari` overwrote each other in
  the shot planner.
- **A thing made per clip needs the clip in its id:** two clips starting at the same mark gave their stand-ins the
  same id, and the moved one overwrote the other in the shot planner (the second time this lesson came up: ids
  derived from data must include every key that varies).
- **Measure shots where the actor is, not where they started:** blocking moves actors, so the planner follows each
  actor's `move` keys across clips and measures a moving clip halfway.
- **"Medium shot" names a body part, not a distance:** the framing check measures the part a shot is about (face,
  chest up, waist up) as a share of the frame. The pilot's "MS" at 3.2 m read as a wide shot until it was measured.
- **`--no-build-isolation` means every build backend is ours to install:** Kimodo's demo pulls NVIDIA's `viser` fork
  from git, which builds with hatchling; `setup.py kimodo --demo` failed until hatchling joined the build tools.
- **A patch meant for other machines needs `--src-prefix=a/ --dst-prefix=b/`:** this machine's git has
  `diff.mnemonicprefix`, which writes `i/` and `w/`, and the patch refresh's own parsing broke on it.
- **Kimodo's demo keeps its skeleton on the GPU:** tensors made to run its FK (the pose window's rest pose) must be
  created on `skeleton.neutral_joints.device`, or TorchScript refuses the indexing.
- **Measure a prompt before trusting it:** of 12 horror prompts, 4 didn't do what they said on the first wording
  (no crouch, no cower, no getting up, a fast retreat). Two were fixed by rewording; two can't be (crouch-walking,
  slowness), and those need a pose or a paced path. `tools/kimodo_presets.py check` is the measure.
- **A run of things that each "stop the last one" needs its own token:** the score room's audition plays every
  variation in turn, but a take ending by itself went through the same stop as the Stop button and ended the whole
  audition after one card. Ending a take (`endPlay`) and stopping what the user started (`stopAll`) are two calls.
- **A compressor and limiter on the music bus make every cue the same loudness:** a dread bed rendered as loud as
  the jump scare (both about -14 dB RMS). Cue levels go after the limiter (the master), never on the notes.
- **A server started from a script must not keep the script's output:** the launcher's page servers inherited its
  stdout, so anything reading the launcher's output (a pipe, a test) waited for the server to end. Windows gets its
  own console window; elsewhere the server's output goes to Saved/launch/<name>.log.
- **UnrealClaude's bridge lists only its simple tools:** taking the script tools out of `HIDDEN_TOOL_NAMES` made
  them "mega" tools, which aren't listed either (16 of 28 shown). `setup.py unrealclaude --show-scripts` now adds
  them to `SIMPLE_TOOL_NAMES`; after a router change, restart Claude Code so the bridge reloads.
- **Start the editor before Claude Code:** the bridge gives its tool list once, when Claude Code starts, and never
  says it changed; started before the editor, Claude saw only `unreal_status`. Check the editor runs *this*
  `.uproject` too (`pgrep -a UnrealEditor`): it once reopened a stray template and the bridge never came up.
- **Story ids are unique across the whole file, levels included:** the scene builder's layouts planned on their own
  but failed beside an existing level (two `start`s, two `front_door`s). Anything added to a story is renamed
  against `takenIds()` first.
- **`node --check file.js` passes an ES module with a syntax error:** it reads the file as CommonJS and said nothing
  about a `const` declared twice, which then stopped the whole desk from loading. Check the desk's modules with
  `node --input-type=module --check < tools/director/<file>.js`.
- **A BroadcastChannel never crosses browser contexts:** Playwright's `browser.newPage()` makes a new context per
  page, so a test of the builder telling the desk it saved has to open both pages from one `newContext()`.
- **A level check that reads every level's rooms has to keep to the level it checks:** the doorway clearances of
  one level were tested against another level's furniture standing in the same place, and failed a borrowed level.
- **The desk's server imports storykit once:** after changing `plan.py`, `level_check.py` or anything it imports,
  restart `serve.py` (find its PID, kill it, start it again), or the pages plan with the old code. The kit's pieces
  were missing from the builder's 3D view, and a level check failed on a rule already fixed, both for this reason.
- **Unreal mustn't watch `Content/` for new files:** the merge put `Kit/presets.json` there, Unreal offered to import
  it as a DataTable, and the options dialog opened blank on another workspace and held the editor (and every MCP
  call) in its modal loop. `bMonitorContentDirectories=False` (setup.py configure), and a Hyprland rule keeps all of
  Unreal's windows on its workspace (4).
- **The `.uproject` must be Unreal's first argument:** `ue` put its `-ini:` flag first, and Unreal opened the Project
  Browser instead of the project (that's how a stray template got opened). The launcher now puts a `.uproject` first.
- **A script that opens a map crashed UnrealClaude:** it counted the actors afterwards in the world from before the
  script, which the new map had freed (SIGSEGV). Fixed in `ScriptExecutionManager.cpp`, kept in
  `setup/unrealclaude_linux.patch`.
- **`-ExecutePythonScript=` on the editor runs before the project's Python is on the path, and quits the editor
  after.** The desk's Generate leaves `Saved/Story/<G>/generate/pending` instead, and `init_unreal.py` runs it once
  the editor has loaded.
- **The editor saves its per-user settings over the project's defaults:** `bMonitorContentDirectories=False` in
  `DefaultEditorPerProjectUserSettings.ini` did nothing while `Saved/Config/LinuxEditor/` said True. Those settings
  aren't visible to Python either; `init_unreal.py` corrects the saved file.
- **A Slate tick isn't an engine frame:** with the editor in the background Slate ticks many times per frame, so
  `shots.take` queued all 18 cameras inside one frame and one picture came out. Wait on
  `SystemLibrary.get_frame_count()` for anything that needs the renderer.
- **Unreal's glTF import scales a skinned mesh's bones by their nodes but not its vertices:** MHR binds in
  centimetres under a 0.0098 node scale, so Mari came in as a 172 m skin on a 1.6 m skeleton and drew nowhere near
  her bones. The desk now exports a fresh skeleton with no scales, vertices and bones in metres, the mesh at the
  identity. Check an imported body's reference bones against its bounds before posing it.
- **The editor keeps a Python module it has imported:** `storykit.generate` reloaded the rest of storykit but not
  itself, so a Generate ran yesterday's code. The desk's script reloads it first.
- **FBXLoader's vertices aren't shared:** normals recomputed on them come out flat (a faceted body in Unreal). Keep
  the file's normals.
- **The desk lights every room with an ambient; Unreal's sky light doesn't get through Lumen's walls:** a room with
  no lamp (the Pilot's cellar stairs) played black in Unreal while the desk showed it. Each room gets a shadowless
  fill (`importer.room_fills`). And anything the desk lets the player do during a scene (look round the cone) has to
  be in the bake, or Unreal locks it.
- **The desk's server sends only the file types it lists** (`serve.py` STATIC): Play's CSS came back 404 until `.css`
  was added. A new kind of file in `tools/director/` needs its type there. A test can run its own desk beside the
  open one: `DESK_PORT=8781 python tools/director/serve.py`.
- **Inside a box you see nothing of it** (three.js draws front faces only), and a flat see-through tint over the
  whole view doesn't read as "I'm in a locker" either: the Pilot's locker scene looked like standing in the hall.
  Slats (an alpha map of bars, drawn both sides) read at once and keep the room visible between them
  (`stage.seeThrough`).

- **Mesh to MetaHuman needs a head, not a face:** the face-only mesh from `face_mesh.py` (MediaPipe's 468 points)
  traced badly: with no skull or ears the tracker struggled to place things, and MediaPipe's eye openings are too
  soft to read as eyelids. Bend a whole head template to the points instead (the template's own eyelids, shaped by
  the photo's), best the MetaHuman base head itself, so the result is already lined up.
- **Every stitched edge needs the same number of points on both sides:** `garment.py` sampled a straight edge as one
  point and a curve as twelve, so the drape skipped every straight-to-curved stitch (the skirt's waistband floated,
  the t-shirt slid off its shoulders). Straight edges now get twelve too. And GarmentCode's flat placement, 30 cm in
  front and 25 cm behind, sews shoulder seams straight through the shoulders: lay the panels on the body first.
- **To open MHR's sealed shell, move points, don't hide triangles:** hiding the triangles inside the lid outline
  left slivers over one eye (MHR's triangulation differs round each eye); sinking every point inside the outline
  behind the eyeball works whatever the triangles are. The mouth is still open: its visible inside isn't within the
  inner-lip outline at all, so the same trick showed a pale wall (a look at MHR's mouth geometry comes first).

**Sewing springs: gentle, not strong (2026-10-21).** Blender's `sewing_force_max` at 30 closed a GarmentCode t-shirt's
10 cm seam gaps so hard that it pulled the shirt off the shoulders and crushed the sleeves into rolls up the arms;
heavier or lighter fabric and stiffer bending didn't help. At 8 the seams still close (0.5 mm), the shirt stays on the
shoulders with real short sleeves, and skirts and pants drape as before. Try `DRAPE_SET='{"key": value}'` on a few
settings side by side (renders stacked) before rewriting the drape.

**MHR's mouth is sealed by a membrane (2026-10-21).** The open mouth's "inside" isn't a sock of skin behind the lips:
it's a sheet of triangles whose corners all sit on the lip line, stretched across the gap when the jaw drops. Sinking
points, depth tests and floods inward from the lip line all miss it (they also leaked onto the chin at the corners).
Find it by what it does: near the mouth, the triangles that grow ten times or more in area under jawDrop; colour those
per corner. Measure the expression's effect before guessing at the geometry.

**A simulation undoes what the generator promised (2026-10-22).** The grown hair kept off the face and cut its bangs at
the brows while it grew; once the same strands became wig clumps under gravity, side locks fell across the face and
bangs sagged into the eyes, and in twin tails the bangs took the tie and were pinned whole. Every rule the shape keeps
(the face keep-out, the bangs' hold, who is pinned) has to live in the step too, not only in the shape it starts from;
and read the exported data (pinned counts per clump) as well as the pictures.

**Collide hair with the skin, not a star-shaped head (2026-10-22).** Hair kept off the head by a radial field (the
farthest skin in each 11° direction) hung a median 26 mm off the cheeks: near an ear or a cheekbone the farthest skin
in that direction is the ear's tip. Pushing along the nearest skin point's normal (a hash of the skin's points, 1.2 cm
cells) brought it to 19 mm (the rest is physics: straight hair drops from the skull's widest part), and the hair now
lies along the face. Measure distance to the skin at face height; a front picture hides it.

**Pin cloth round the body, not onto its nearest points (2026-10-22).** Locking a waistband by moving each of its
points to the nearest skin point piled several onto the same spot on a heavy body: coincident and crossed points
blew Blender's cloth apart (seams a metre apart). Laying them round the body's cross-section at that height (each at
its own angle from the middle, at its own height) keeps their order and spacing, and the pants stay on. And don't
flatten a scooped neckline to one height: it hitches the whole top up.

## A chart is pseudo-code, not prose (2026-10-28)

- **Write the writers' room's script as literal things:** who does what with which thing, short lines, sounds as cues,
  a `Note:` for anything the director must know. No narrative description ("she's soaked", "cicadas outside"): every
  described thing is a model, a state or a shot someone has to make. Chilla's Art's density: few words, a to-do list.
- **The player never speaks a line** (no `You: "..."`): his answers are an act and a thought, `[ Greet ] She looks
  cold, welcome her inside --- [ Question ] She looks different`, and the player imagines what he said. Only the cast
  talk in quotes. A talk needs a line from someone in the cast before the answers.
- **His thoughts know only what's in front of him:** never a thought that states what the player hasn't been shown
  ("Natsu came back. Tell her", "Twelve years. Is it really her?" before anyone said twelve years). Facts come from
  outside (the list, her lines, the props, the phone), and his answers react to them; the player has amnesia with him.
- The first chart of The Visitor read like a novel (scene-setting lines, a wet arrival needing its own model, a cold
  open); the user asked for pseudo-code. Rewritten terse, the same structure held.

## Tops: no cuff bands, sleeves at the arms' angle (2026-10-22)

GarmentCode's tops on our A-pose bodies came out cropped and crumpled. Not the tightness or the sewing force: the hem
rode up on the hips until the top flared (`shirt.flare` 1.25 to 1.35) and was long enough, and the sleeves folded up at
the wrist while they had a `CuffBand` (the cuff panel pulls the sleeve's end in and the drape can't pass it over the
hand). Cut sleeves at 45 degrees (the arms' angle), 0.8 long, no cuff. Compare variants of one design side by side
(four drapes in parallel) before changing a preset.

## Three.js converts a colour once (2026-10-22)

Since r152 `Color.set("#hex")` turns the sRGB hex into linear itself (ColorManagement is on). The procedural skin and the
strand hair also called `.convertSRGBToLinear()` after it, so their colours went through twice: the skin came out an
orange tan, darker than the same tone without the shader, and the hair darker than picked. Set a uniform colour with
`.set()` alone. Compare a shader's colour against plain `material.color` with the same hex when a look seems off.

## A frame with a wig in it is never the same twice (2026-10-22)

The touch-up's check compared the picture before a stroke and after its undo, byte for byte, and failed although the
paint layer was back to empty: two shots taken one after the other with nothing changed differ by thousands of pixels,
because the wig keeps swinging. Measure where the change is meant to be (the mouth, where no hair falls) and the layer
itself, not the whole frame. "A changed picture" alone proves nothing for the same reason: check it changed where it
should.

## The game's lens is 90° across a 16:9 screen, not across whatever canvas (2026-10-22)

The Studio's first POV view took `game.fov` (90° horizontal) against its own canvas, nearly square beside the side
panel: 94° up and down, a medium close-up that showed the whole torso. A first-person check frames like the game's
screen: 16:9, so 59° vertical, drawn in a 16:9 frame with bars round it, and any picking (the brush) goes through that
frame. Distances from DIRECTING.md's shot table (MCU 0.7 m, MS 1.2 m) only mean what they say through the right lens.

## A tool's launcher can't share its name with its package (2026-10-22)

`tools/gshair.py` (the launcher) and `tools/character/gshair/` (the package) are both `gshair` to Python: the
package's own CLI put `tools/` on `sys.path` first and imported the launcher instead of itself. Put the package's
folder before `tools/`, or name them apart. The launcher runs the package in its own environment with `-I`, so the
order inside `cli.py` is the only thing that decides it.

## OpenCV's hue is half a degree, and "the largest piece" isn't the wig (2026-10-22)

Green is 120 degrees, so 60 in OpenCV's 0 to 180 hue: a green key written for 30 keyed nothing. And with patterns on
the floor for the cameras to track by, the largest non-green piece of a frame is the floor, not the wig: keep the
piece that is big, central and high (area weighted by its distance from the middle and its height in the frame).

## A face's PnP has a mirror solution, and a small reprojection error doesn't rule it out (2026-10-22)

The 468 face points are nearly flat, so PnP has two answers: the camera in front of the face and its mirror behind
the head, both within a pixel or two at a small image size. EPnP, SQPnP and a RANSAC consensus all landed in the
mirror with a fine rms, and every chained camera followed it round. OpenCV's iterative solver from its own start
finds the right one; check it anyway (the camera must sit on the face's side) and never trust the rms alone.

## A synthetic camera must be a proper rotation (2026-10-22)

The check's look-at built its camera rows as right = up x forward, down = right x forward: a left-handed frame
(determinant -1), a mirror. Every real solver returns proper rotations, so PnP could only land in the mirrored twins
of such a camera, with a fine reprojection error, and two fixes went into the solver before the truth was checked.
Check the truth first: a camera's determinant, and the subject's left on the viewer's right.

## A frame from bound landmarks inherits the binding's asymmetry (2026-10-22)

The face landmarks bound onto MHR put 234 and 454 (the ear sides) 2.4 cm apart front to back on a body that is exactly
symmetric, so an ear-to-ear axis from them turns the head's frame about 10 degrees. Anything placed in that frame (a
reference's cameras, a splat's fit) comes out turned. Build a frame from the mesh's own symmetry: one vertex and its
mirror, not two landmarks.

## A test's clicks have to be where a user could click (2026-10-22)

The salon's first runs "failed" four times on clicks no one would make: ends off the bottom of the view, a fringe's
end in the air 9 cm in front of the face, roots grazing the silhouette's edge, a root below the temple's hairline. Each
time the page did the right thing. Aim a test's clicks at what's visible: points on the skin inside the silhouette,
inside the view at that zoom, and check the page's refusals before calling them bugs.

## Joining gaps round a head closes over the face (2026-10-22)

The fill's trace joins the gaps between locks with a closing on the grid of directions round the head. A fringe above
and two sidelocks beside the face surround it, so the closing filled the face, and a lock's footprint spread a cell
round each point bled onto the eyes. Mark the face (the front, below the hairline, above the chin) and never join
across it; give a point only its own cell; keep the face clear below the brows unless the user brings it back.

## Wait in time, not frames (2026-10-22)

The salon's physics stopped its loop after 150 still frames. A heavier hair shader dropped the software renderer's
frame rate and the same 150 frames took longer than the test's 15 s, so SALON failed with nothing wrong. Anything that
settles, times out or animates goes by the clock (here: 2.5 s still), never by a count of frames.

## Hair has to be laid down, not just kept out (2026-10-22)

The salon's curves were drawn straight, bowed out by a fifth of their length, and only ever pushed out of the head, 12 mm
clear: on a round head nothing pulled them back down, so hair floated 13 to 18 mm over the scalp. Combed hair lies on the
scalp until it leaves the head: pull every point near the head down onto it, then let the user bow it. And a setting the
wheel changes while placing (the bow) must start over for the next lock, or the next lock floats too.

## A reach in centimetres meets handles spaced by the lock's length (2026-10-22)

The pull's first test used a 4 cm reach and expected it to bend the strand it pulled: nothing else on that strand moved,
because a 35 cm strand's six handles are 6 cm apart (only the next strand, 2.5 cm away, was in reach). Distances
between handles grow with the lock, so a reach that suits a fringe takes nothing on a long lock. Measure the spacing
before picking a reach (for a default or a test): the salon starts at 8 cm.

## A preview is only true if it's made the way the result is (2026-10-22)

The salon's gravity drew each frame from the fall alone, and switching it off kept the hair through another path: twins
rebuilt as their originals' mirrors (they had fallen on their own, a little differently) and Layer by height re-laid
on top (it wasn't applied while falling). The user switched off and the hair moved. Whatever shows a result before
it's kept (a preview, a scrubbed frame) goes through the same steps the kept result will; the check compares what's
drawn before and after, not the data.

## A map round the skull is only true on the head (2026-10-22)

Layer by height kept, per direction from the skull's middle, how far out the hair below reached, and pushed later
hair past it. Hair that pokes out or hangs below the head lies along those same directions, far out, so a strand
combed over a poking one was lifted 11 cm along it, and with gravity's fallen hair, 45 cm. Only what lies on the head
belongs in such a map. The second try counted a lock's whole cross-section wherever its lowest edge lay, and a sheet
touching the cheek with its other edge 5 cm out made a spike; count each point up to the lock's own thickness.

## A page test reads what's drawn only after drawing it (2026-10-22)

The salon draws on the next animation frame, and a step that read a new lock's evaluated guides straight after the
click passed for days, then failed once (the frame hadn't come). Every step that reads drawn state (EVAL, meshes)
calls the page's render() first.

## Hair without friction slides round the head (2026-10-22)

The cover's sheets were combed out from a middle parting, and the fall (Verlet, the head pushing points out, no
friction) swung them round the back of the head into a crest: on a frictionless head, hair lying on top creeps to its
lowest path whatever way it was combed, and the head's slight tilt decides which way. Hair that lies needs friction
where it touches: the slide along the surface held back by friction times how far the point was pushed out (Coulomb,
position-based), so it stays where the slope is gentle and slides where it's steep. The other side of it: hair laid
along the head with friction is already where gravity leaves it; to check that a fall happens at all, make something
that overhangs.

## A sample's number isn't its place along the lock (2026-10-22)

The salon's guides were 24 samples spread evenly, and the taper, the texture, the dome's height and the bake's skin
weights all took sample k as k/23 of the way along. Bending the roots needed samples closer near the root, and every
one of those had to change to the sample's own place (each guide's `t`), as did a check that measured "half way" at
sample 12. Carry the place with the samples (or resample by arc length) instead of deriving it from an index.

## Hair finished by gravity needs stiff roots, and rows that meet (2026-10-22)

The first presets fell badly three ways. Long hair combed back off the face slid down the forehead onto it (steeper
than friction holds, and nothing in the chains stiffened the roots): the drop now holds each strand's first few cm to
its comb, fading along it (Root hold), and long locks get a control point every 6 cm so the hold has something to
hold. Rows too far apart left skin between them (short hair must reach past the next row's roots), and a row that
ran into the ear was skipped whole (split rows into the runs that are on the scalp). Measure the scalp covered
(SALON: at least 90 %) instead of judging it from one view.

## Shade hair by what's over it, not by the skin (2026-10-22)

The hair shader darkened hair near the skin (inner layers in shadow). Short hair lies near the skin everywhere, so a
crop's top, its outermost hair, came out black, and with the darkened scalp under it read as bald. The depth it
shades by is now how far a point is under the hair's outer surface (all the hair shown, round the skull's middle):
the outermost hair is lit however close to the skin it lies.

## Clear the signal before waiting for it (2026-10-22)

SALON's bake step clicked Bake and waited for the status bar to say "baked". A step before it now bakes too, so the
status already said "baked": the wait returned at once and the step read the earlier step's files (no physics lock, the
wrong vertex count). A test that waits for a message (a status, a file, a flag) clears it first.

## Restarting a server: kill the process that holds the port (2026-10-22)

After a change to serve.py the salon's server had to restart. The PID found first was a wrapper; killing it left the
old server running (started before the change) and the new one failed with "Address already in use", while the page
still answered, from the old code, which refused the new file. Check the running server's start time against the
change, kill that PID, and start the new one detached; then check the log, not just that the port answers.

## A check that measured nothing is a broken check (2026-10-22)

The Clip blend check counted 0 points over the base three times: first the test strand bowed out above the base (it
was never in it), then the test subtracted the collider object instead of its centre (NaN everywhere). It failed
rather than passed only because it asked for a minimum. Every measuring check states how many samples it measured
and fails on none.

The salon's bake was written as hair for Unreal on its own, and the user had to correct it: hair goes onto the
Character Studio's characters, and only finished characters go to Unreal. DECISIONS 2026-10-21 already said one app
for everything character, with the export to Unreal from it. Before building where a tool's output goes, read where
the decisions send it, and say the whole route (made, used, exported) back to the user.

An element's `hidden` loses to a CSS rule that sets its `display` (`.row { display: grid }`): the Character Studio's
Hair tab "hid" the style's rows for strand hair and they stayed on screen. Pages that hide with the attribute carry
`[hidden] { display: none !important; }`.

The bake preview's `let PREVIEW` was already the lock tools' placement preview: a second `let` of the same name kills
the whole module at load, and the salon came up blank with no status. Before adding a top-level name to a long page
script, grep for it (`\bNAME\b`).

## The eye is a picture problem, not a mesh problem (2026-10-23)

- **Don't fix the eye by moving the shell's vertices or cutting the skin around the eyeball.** MHR's eye region is too
  coarse: conforming the lid vertices onto the eyeball sank the eye and left shards of lid over the iris, and cutting
  the skin per pixel in front of the eyeball with a darkened socket read as a hole. Both were dropped. The way the
  user chose: they pick the eye's vertices themselves and the eyeball's picture is projected onto them.
- **A wide cut deletes what sits after it:** cutting from one `def` to the next `def` also took the module constants
  between them (`HAIR`, `SALON_FILES`): the server ran and failed on its first request. After a cut, `pyflakes` the
  file before restarting.
- **An eyeball grown from its front still widens to the sides:** pinning the pupil keeps the front in place, but a
  23 mm sphere reaches past the eye's corner and out of the temple. Drawing the eyeball only through the opening (the
  cut triangles into the stencil, the eyeball where it's set) lets it grow freely. And the eye plane (the eyeball's
  paint projected onto picked vertices) was rejected by the user too: a real opening with a real eyeball reads better.
- **Replacing a prefix of a line moves its tail:** swapping the `DP[...]` part of a line that also set the normals put
  `DN[...] = NP[...]` after the new line's comment; every normal was zero and the body rendered black. Replace whole lines.
- **Cutting along MHR's triangles leaves teeth:** its lid edge is a few long thin triangles that poke into the opening
  on one side; whichever rule picks them (the middle inside, all corners inside, two corners inside), some side gets
  teeth. Cut per pixel in the skin's shader along MediaPipe's smoothed outline instead, and draw the eyeball over what's
  inside the opening (MHR's lids fold inwards, in front of any eyeball). Measure it: the head's inside in magenta, the
  magenta pixels counted over sixteen poses, front and three-quarter.
- **Where a measurement can't settle a look, hand the user the control:** three tries at the lower lid's cut (a fixed
  drop, tapered, even) each left a step somewhere on one face. The eyelid line as sliders, with the line drawn on the
  face and a saved default, ended it.
- **A frame that's already open doesn't see new data:** the Hair tab saved the body every visit, but the salon's frame
  only loaded it the first time (the address hadn't changed), so later body and face edits never reached it. Tell an
  open frame to reload (`__salon.refreshBody`), and check it with a second visit after a change.
- **Find a model's features by what its shapes do, not by landmarks mapped onto it:** MediaPipe's lid points sat
  3 to 4 mm inside MHR's sculpted lids, and no slider range fixed that well. The triangles MHR's own blink squeezes
  shut are exactly its eye opening (as jawDrop's stretched ones are the mouth's): their edge, walked as one loop, is
  the lid line, and it rides every expression.
- **A measure that adds geometry can fail where the render doesn't:** the gap test's magenta inner surfaces blocked
  the eye's stencil where the lower lid folds in (looking down), a line no normal render shows. Check a measured fault
  in real colours before fixing it.
- **Find a feature on the face its shapes were made for:** the lid line was found on the character's own face, so on a
  face bent to a photo (bigger, rounder lids) the blink no longer met, the squeezed strip came out a fragment and the
  cut was distorted. Found once on MHR's base face, each point a place along a mesh edge, it rides any shape or fit.
  And an additive expression made for the base face doesn't close a fitted one: the blink has to take the lids from
  the fit's own offsets to their common one as it closes. Test a feature on a fitted face, not only the bare one.
- **Find what makes a spike before smoothing it:** the baked hair's sharp tents looked like the bake's fault, and three
  smoothers in turn made it worse (easing curves cut into the skull or swung long strands out; flattening bumps
  flattened the roots' lift and opened the partings). Measured (bumps and corners per card, live against baked, every
  point kept against 8), the ring round the crown was in the styled hair itself, and only a few tents came from the
  thinning. What worked: keep points where a card bends, and press what stands out of the hair's surface in towards it,
  proportionally, eased along the card.
- **A mesh builder that assumes equal cards breaks when they aren't:** the cards' triangles were offset by `j * n * 2`,
  every card the same length; once the bake kept more points on some cards, triangles joined unrelated cards in long
  pale bands. Offset by a running count.
- **A throw in three.js's frame loop stops every frame after it:** `setAnimationLoop` asks for the next frame after the
  callback returns, so one exception (the handles read the normals before the first compose made them) froze the view
  for good. Anything new in the loop gets its own guard.
- **MediaPipe's points on MHR's base face aren't symmetric, the mesh is:** the jaw's angle came out 4.5 cm apart in
  depth between the sides. For anything mirrored, average each pair across the middle.

## Cloth over cloth: measure what's under as a thickness, don't push off its mesh (2026-10-23)

The tailor's first layering pushed each garment off the ones under it with the closest point on their meshes. An open
mesh has no inside: at a hem, a waistband or a lifted pocket the closest point's normal points anywhere, and the
t-shirt over the pants came out in a ruffle at the waist. Measuring the garments under it as a thickness over the
body (how far out they reach above each point of the skin) and starting the new garment's ease there fixed it, and it
was faster. Push only off closed surfaces (the body).

## Don't move cloth onto a curtain; let it bridge (2026-10-23)

Woohill's "hang" (below the bust the cloth may only fall, never follow the body in) ported as a radial push onto a
vertical curtain flipped the triangles under the bust: their normals turned over, and pockets lifted along them tore.
The same look comes from relaxing longer: smoothing along the normals with a push back out to the ease is a membrane,
and with enough rounds it spans from the bust to the belly by itself. Rounds are cheap on the coarse body (four times
fewer points, each round reaching twice as far), so relax there and split the triangles after.

## A walk finds its own leg (2026-10-23)

The tailor's push off the skin was slow for loose garments (a jacket 5 cm out: every nearest-point search grew to that
radius, 12 s a blazer). Walking the skin's mesh from where each bit of cloth came from made it 15 times faster, but a
walk stops at a local nearest: between the thighs the trousers found their own leg while the other was closer, and
1% of the shorts went under the skin. One proper search at the end didn't fix it (pushed off one leg, the cloth landed
in the other's clearance). What did: find up front the points another part of the body comes near and search properly
for those every round; walk the rest. Run TAILOR on all five bodies before calling a speed-up done.


## Cloth's skin weights: a smooth function of place, the same width for every layer (2026-10-23)

Copying the closest skin point's weights onto each bit of cloth (its triangle's corners blended) looked exact, and a
sit gave the trousers' waistband a spike at the small of the back: over the spine's groove, points either side project
onto its two walls and the one on the line between takes weights of its own, then the bending back swings it out.
Blending wider the farther the cloth stands off was smooth but gave a shirt and the trousers over it, a few
millimetres apart, different widths and so different weights, and the shirt came through the waistband in a sit. What
worked: a Gaussian over the skin's points near the cloth, the same width for everything close to the body (wider only
for cloth that stands off, a skirt's hem). And before blaming the cloth in a deep pose, render the bare body in it: in
plain linear skinning the thighs swell up into the belly in a sit, and the cloth only follows.

## A full thigh crosses the middle (2026-10-23)

The tailor found the crotch as the first slice down with no loop across x = 0. On a full body each thigh's own loop
crosses the middle by a few millimetres, so the crotch came out 6 cm low (the clothes cut into the body there) or not
at all, and the desk's figure of the same body crashed the frame. A torso's loop reaches well to both sides of the
middle; a thigh's barely: count a loop as the torso's only when it does (and only there: the same test on the neck's
rows lost the neck on the desk's figure, and a collar came up over the chin). Test new body shapes at their extremes
(the full and slim ones in `tailor/bodies.json`) on the desk's figure as well as on the packed body: the figure
stands with its foot bones on the floor, not its soles, and the slices' `at(y)` that forgot the lowest point gave a
skirt the outline of a slice 2 cm off; under the chin, a slice cuts the neck and the jaw, three loops like an armpit's.

## A test that takes the first row breaks when the data grows (2026-10-23)

STUDIO's clothes step dyed "the first worn garment" denim and waited for the shirt to change: when the outfits got
their socks and shoes, the first was the socks, and the step timed out (and its drag looked for the shirt's hem from
the head view the skin and layer steps had left). Find a garment, a row or a handle by its name, and set the view the
step needs. Run STUDIO after changing outfits or designs, not only TAILOR. In a fresh container it needs
`python tools/face_mesh.py setup` and `libegl1` before its face steps run.

## A click that was done can still time out (2026-10-23)

STUDIO failed now and then on a step that had nothing to do with the change (the strand hair, then the procedural
skin): the log said `click action done`, then `waiting for scheduled navigations to finish` until the timeout. With a
heavy shader in software GL the page is too busy to answer Playwright's after-click check. The Studio never navigates
on a click, so the test's clicks pass `noWaitAfter: true`; a flake that moves from step to step is the test's, look at
its log before re-running it.
- **A tab that saves the body must wait for the body's face:** changing the body schedules a face re-fit (350 ms, then
  the worker); the Hair tab saved the body before it landed and the salon's head was 0.7 mm off. Entering the Hair
  tab now runs a pending fit at once and waits for it.
- **Measure a lens's barrel on a lone straight line, not a grid** (UltraVHS): following the darkest pixel down a
  checker grid slips onto the crossing lines and fits k twice too big. A chart of vertical lines only, each traced in
  a narrow window, gives k back exactly (0.085 in, 0.085 out).
- **A jaw from the face's points follows the lips, not the bone:** fitting a rigid motion every frame to the points
  jawDrop carries turned the teeth 27° on a pucker and 14° on a lip roll: the lip shapes move those points too. The
  jaw is now fitted once to each of MHR's jaw shapes alone and mixed by their weights, so only jaw shapes move it.
  The check that it rides the jaw compares the jaw's own points carried by the teeth's motion, not one landmark: the
  chin and the lower lip are on different lever arms and drop more than the teeth's tip.
- **Cut an opening along a smoothed line, not along triangles** (the mouth, as the eyes already were): the teeth first
  showed through MHR's membrane triangles, which missed the lips' inner corners (grey wedges across the mouth in a
  snarl) and left a jagged edge. Growing the triangle set by stretch either left slivers or ate into the lips. The lip
  line is now the seal's points (upper or lower by how far the jaw carries them), the upper lip's lowest edge and the
  lower's highest, sampled corner to corner and smoothed, cut in the skin's shader, a dark bag behind it.
- **Try the presets before engineering around a test pose:** the "flap" in a pout was a full pucker stacked on a 0.6
  funnel, a pair no preset makes; MHR folds the lower lip out over itself there. Two cut changes didn't remove it
  (it is the face's own geometry, with nothing behind it). The fix is a pairing limit on the weights (`paired()`), the
  place mocap goes through too.
- **An opening counts from rest:** MHR's lips overlap at rest (the lower one ~1 mm up inside the upper's curl), so the
  seal's reach read as 0.6 mm open with no expression, and the first lower-lip curl parted the lips and showed the
  teeth at rest. The opening is now what the seal reaches beyond its reach at rest; what's between the lips at rest
  is the lips' inside, not the mouth.
- **The painted iris isn't the Iris size on a grown eyeball:** the eye painter shrinks the iris's angle when the eyeball
  grows (it keeps its real size), so a check that looked for the iris's edge at the slider's angle sampled plain
  white. Measure where two paintings differ, not where a setting says the feature is.
- **Wait for what a step is about, not its first sign:** a new character's name shows as soon as it starts loading; its
  look is applied (and saved) only once loading is done. The check that read the look on the name saw the old values.

## A state that's already true isn't a wait (2026-10-24)

STUDIO's accessories step reopened the character and waited for its four accessories to be drawn: they already were,
from before the reopen, so the wait passed at once, the cleanup ran while the character was still loading, and the
loaded file put the four back (the save the step then waited for matched the last save's word, "saved"). Before
waiting for a state an action brings, take it away first (clear the drawn accessories, clear the status line), then
wait for it to come back; and read the file to check a save landed.
- **Two headless browsers at once starve each other:** PLAY failed on its second step ("the play clock stopped") while
  STUDIO ran beside it: on the cloud's software GPU each frame took so long that the game's clock barely moved, and a
  wait on it timed out. Run the browser checks one after another. Even alone, a long run slows as it goes (the locker
  late in PLAY draws 2 frames a second), so every wait on something the game does has a 60 s bound, not 10 or 15.
  PLAY's triggered scene (sitting on the second chair) still waited 5 s for the scene to take over and missed once
  after a long TIMES run; it passed alone. It has the 60 s bound now: a short bound proves nothing about speed here.
  Later the locker step missed its 60 s once, again right after TIMES, and passed alone: run PLAY first and TIMES after
  it, with nothing else between.
- **cannon-es mixes two bodies' own friction and bounce only when both have a material** (else the world's default
  contact is used): a physics kind's `friction` and `bounce` would do nothing against the floor, so the level's static
  bodies have one too (friction 1, bounce 1: the product is the thing's own). Found by reading its narrowphase before
  tuning a plushie; read how an engine combines settings before tuning them.

## Lay a necklace on the body itself, not on a model of it (2026-10-24)

The first necklace fell through the body: its collisions were a stack of polar slices (the outermost skin by angle
round each slice's middle), and near the chin a slice holds the jaw too, so round the neck it measured 77 cm; with the
start fixed it caught on a saddle the slices invented and hid under the jaw. A narrow-band distance field built from
the mesh's own triangles (4 mm grid, a band either side of the skin, signed by the nearest triangle) gave the drape at
once: the back on the nape, a V down the chest. And a ring round the neck is found from the neck's middle outward (the
first skin met), not from outside inward: on a short neck the shoulders stand further out than the neck at the same
height, and a ring found from outside goes round them. When something lies on the body, test it against the body's
triangles; a simplified shape is wrong exactly where things touch.
- **Pick a character only once the list is in:** a probe set the character picker before the page's own list had
  loaded, so the pick was lost (the page opened "no one", then the first character), and the accessories it put on
  were wiped when that load finished. The Studio's `open()` now stops at its next wait if another character is
  picked meanwhile (an earlier load could also have finished last and saved the wrong character's state over the
  new one); a probe waits for the picker's option before choosing it.
- **A distance along a mesh's edges draws polygons:** the nails measured from the fingertip along the skin's edges
  (Dijkstra) came out as hexagons, its rings following the edges' directions. A straight coordinate along the finger
  is smooth; what was wrong with it was only where the nail ended (on the tip's curve, so the free edge wrapped over
  the end): the end moved 2.5 mm back, the outline stayed smooth. Fix the parameter before the method.
- **A sparse fabric on a small garment is a pattern of dots:** the stockings' lace (a fine net, mostly holes) on a bra's
  7 mm straps and small cups read as dotted outlines, and nude lace on skin as nothing. Lingerie got solid fabrics
  (silk, satin, velvet, jersey); the lace stays for the legwear it was made for.
- **Scale the body, never the road:** the desk's forward kinematics scaled every joint by the cast member's height,
  the blocking's travel included, so Mari (1.62 m on a 1.70 m skeleton) stopped 5% short of every mark, and where a
  Kimodo walk (whose travel was added after the scaling) met blocking she slid 22 cm. Walk a whole scene frame by
  frame and print the biggest jump of any joint (and which): it found this and the blocking's stride switching off
  in one frame (a foot 41 cm), neither visible in a still.

## `node --check` passes a broken ES module (2026-10-25)

The desk's files are ES modules with a `.js` name. `node --check file.js` on one of them exits 0 even with a syntax
error in it (a bracket too many in app.js passed it; the browser refused the page: "Unexpected token ')'", nothing
drawn). Check them as modules: `node --experimental-default-type=module --check file.js` (or import the file), and
load the page once after an edit.

## The desk's second tries (2026-10-25)

- **Focus a box the moment it opens:** Ctrl+K's search took its focus 20 ms after opening, so the first keys typed
  straight after the shortcut went to the page. A box that's typed into is focused synchronously, in the same call
  that opens it.
- **Never await the Watch from a probe's evaluate:** `window.__dd.watch()` runs until the playthrough ends, so a
  probe that awaited it inside `page.evaluate` waited forever. Start it without awaiting, then poll for the state
  wanted.
- **Give a lazy picture its size:** the guide's links landed above their sections, because its lazy images had no
  width and height until they loaded, so everything below moved after the jump. Every `<img>` carries its size
  (GUIDE writes them).
- **A simulator that only goes forward answers the present:** life.js `States` advances its timers to the time it's
  asked about; asked about an earlier moment afterwards, it answers with the present (the kettle was already off
  when the test asked what it was at 6 s). Ask in time order, or snapshot and restore.
- **The Watch plays scenes with no run:** a scene previewed alone (TIMES does it) has `RUN` null, and reading
  `RUN.secs` at the scene's start threw. Whatever a scene reads from the run at its start is guarded.
- **Effects are never in a ray's way:** the stage's right-click on the kitchen table found nothing, because the
  steam over the tea on it (a `Points` cloud, whose ray threshold is a whole metre) was hit first and read as a
  wall. Everything lifefx.js makes gets a no-op `raycast`, so a pick, a drip's floor and Play's cursor go through it.
- **Click the desk by selector, not by a handle held across a wait:** GUIDE's quick task failed one run in three
  with "Element is not attached", because the live check redraws the side panel a few seconds after an edit (the
  step before had edited), and the button held was the old one. `page.click(selector)` finds it again.
- **The desk's stage draws when asked:** GUIDE's first pictures of the kettle and the tea came out as the free
  camera's wide default, because the camera was moved from a script and nothing drew it again. Moving the camera
  from a probe, call `camera.updateMatrixWorld()` (a pick reads it) and `render()`.

## The Studio's body in a T-pose, and a flat belly (2026-10-25)

- **A sculpt field is smooth, or it shows:** the first Belly pressed whatever stood in front of a flat line back onto
  it, point by point: flat side-on, but from three quarters the middle sank between flanks left standing, ridged where
  the press let go. Read every centimetre and joined by straight lines, every joint then caught the light as a band.
  A field is smooth over the body (whole in the middle, easing out to the flanks) and between its samples (a
  Catmull-Rom curve through samples 4 cm apart).
- **Wait for the body before measuring it:** a probe that read the Studio's body two seconds after the page loaded
  found it all zeros (its first compose hadn't run), and a working pose looked broken. Wait until POS holds a body.
- **Plain skinning opens the armpit's fold, it doesn't tear it:** raising MHR's arms 48° stretches a few 5 mm edges in
  the A-pose's crease five times and turns a handful of tiny triangles over on the fullest body, all out of sight;
  giving the collarbone a share of the lift barely helped and shrugged the shoulders. Check for tearing (an edge
  longer than any at rest, triangles turned over) and look, rather than guess a stretch limit.
- **STUDIO's ONLY picks steps by any word in their names:** ONLY=pose also ran the teeth ("every speech pose") and
  the eyes ("filled in every pose"), and the eyes failed for want of the face fit the skipped picture steps make. Pick
  by words only the wanted steps have, with the steps they stand on, or run it all.
- **Switch a feature in a check the way its control does:** STUDIO's nails turned them off with `nailLook()` alone;
  the Nails checkbox calls `skinLook()`, which also takes the skin's coat off. Off the check's way, a coat of 1 was
  left on the whole skin, a highlight the old view's sample missed and the T-pose's view from above caught, so the
  polish seemed to change the skin. It took three probes: the camera, the coat, then the switch.

- **Over-relax only one side of a one-sided constraint and the round-off grows:** the drape over-corrected pulled
  edges (SOR 1.5) and gave pushed ones half; from rest a 1e-12 m error grew past a metre in 240 steps. Plain
  Gauss-Seidel stays at 1e-18. Find such things by starting from rest with nothing to do and watching the biggest
  move a step: it should stay at round-off.
- **A bending stiffer in a step than the points it moves are heavy, after the lengths and carried on as speed, buzzes
  for ever:** the skirt's 5 mm wool flipped 1.6 mm back and forth every step at rms 15 cm/s through the strongest
  damping. It's an instability, not a slow settle: each point's step-to-step moves alternated in sign. Capping the
  bend's compliance at the points' own inverse weight (`alpha >= sum w k^2`) stops it; more steps only slow it.
- **Cloth that gives way when pushed shrinks instead of folding:** with compression at 4% of stretch an A-line
  skirt's hem drew in ten centimetres; at half it folds, as cloth does.
- **A worker's two answers to one job need the job's inputs until the last:** the Studio dropped the body the clothes
  were cut on when the cut came back, so the hung clothes that followed were shown unposed (the A-pose's sleeves on
  T-posed arms, looking like funnels); keep it until the job's final message.
- **A field read at the nearest vertex is a staircase, and a point on a step flips:** the drape took the layers'
  height under a point from its nearest skin vertex; two neighbours 6.5 mm apart (a tucked shirt's edge) made a point
  beside a held waistband jump between two floors every step, 5 mm each way. Read it across the closest triangle.
- **Measure the layers under a garment the same way where it's cut and where it hangs:** the drape spread the clothes
  under it wider than the cut had, so a blazer cut to fit started 5 cm under its own floor and was shoved out, its
  edges stretched to double. Count the points that start under the floor before blaming the solver.
- **A loose sliver falls for ever:** the cut can leave a few points on their own where an opening meets a hem; nothing
  holds them, so they fell 2.7 m and kept the drape from settling. Hold what nothing holds.
- **More cloth between two held edges only creeps:** sleeves cut fuller between the shoulder and a held cuff buckled
  so slowly that their end state depended on when the drape stopped (19 mm). Compare two runs of different lengths to
  tell creeping from settled.
- **A bake's key is everything the result depends on, what comes after it too:** a top's drape is held where trousers
  put on over it later close round it, but its key named only it and what was under it, so a t-shirt baked alone came
  back untucked under trousers (10.6 cm off) and the trousers were cut over it. Test a cache by changing each input on
  its own and asking whether the key moves.
- **Layers sag on each other:** a jacket cut over a shirt's hung sleeve, which already hung 2 cm below the arm, and then
  hanging itself, ballooned from the elbow down (7.9 cm off the skin against 3.6 cut). What a later garment closes
  over is held there, as a tuck is. Measure each layer's stand-off from the skin, cut and hung, before tuning the outer.
- **Two projections that can't both be met, each run once a step, pump each other:** the drape bent toward flat once
  after the lengths; on a sleeve (a tube can't be flat) each undid the other and the difference became speed, so a
  cardigan rocked 6 mm at the elbows at 18 mm/s through the strongest damping, at some stiffnesses and weights and
  not others. Damping only moved the band. In each pass together they settle everywhere. Find it by switching one
  thing off at a time (friction, compression, tethers, bending) and by mapping the stiffness and the weight, not by
  tuning the one garment that showed it.
- **Compare a garment against itself only on the same cut:** a drape run longer for a whole outfit re-cut the
  garments over it (the layers under them hung differently), so their points no longer matched by index and the
  comparison showed 35 cm moves and a NaN that weren't there. Hang the layers under it once and vary only it.
- **Measure a limb's thickness round its own middle, and check the result against the rig:** the tailor found the
  wrist as the thinnest place by distance from the arm's straight line; a forearm bent off the line seemed to thicken
  towards the hand, and on the new bases the wrist came out 6 cm either way of MHR's own wrist joint (long sleeves to
  mid-forearm on the woman, over the hand on the man), the elbow 14 cm down the forearm. Nothing checked where a
  sleeve ends. Each slice's radius round its own middle, pooled over its neighbours (a centimetre's slice of the mesh
  holds part of a ring and reads thin), and the wrist where the forearm's thin end gives way to the hand: within
  2.7 cm on every body. TAILOR now holds both to the rig.
- **A check's margin taken from one design is about that design:** STUDIO wanted a t-shirt at Fit 0 a centimetre
  nearer the body than as designed; tailored close on purpose, the designed one was already within 2.5 mm, and the
  step failed with nothing broken. When a design changes on purpose, ask what the step means (here: tighter, and
  nothing left to hang) before moving its number.

## Lashes over the lid's rim (2026-10-26)

- **A landmark line is where it was found, not where a thing grows:** the lashes were rooted on MHR's lid line, which
  runs along the rim's back edge (where the lid meets the eye: the strip the blink squeezes shut), and sent straight
  out. The rim is rounded and 2.4 mm deep, so every lash's first 3 mm ran under the skin and a band of bare skin showed
  between the eye and the lashes. Slice through the lid and look where the line sits before rooting anything on it.
- **A straight way across a rounded rim goes under it:** the first fix sent the lashes along the chord from the line to
  the rim's front edge; the rim bulges over the chord, so they were still hidden in its middle. Cast rays out through
  the skin a third and two thirds of the way, and keep each point a little off it.
- **A window along a sparse mesh is ragged:** the front edge found within 1 mm along the lid jumped between MHR's
  points, a few millimetres apart there, and the lash line zigzagged. Look 2.5 mm either way, take the part along the
  lid off, and smooth along it.
- **What sits right on an open lid needn't on a shut one:** the way over the rim kept as the eye shut smudged a dark
  band down the closed lid (the rim turns down and away); fade it with the opening.
- **A band's texture runs the way its strands do:** the lash line drawn with the atlas running along the lid showed its
  strands as blocks; across it, they read as short roots.

## The T-pose's neck (2026-10-26)

- **Check the rule, not a stand-in for it:** "the head untouched" was checked as "nothing above 88% of the height
  moves"; standing the neck up moves the skin under the jaw and at the nape (partly on the neck's bones), and POSE and
  STUDIO failed with the head itself untouched. They check the points on the head's own bones now.
- **Joints built down a chain differ from the ones they came from by a rounding:** a check that the head's joints
  hadn't moved compared them exactly and found eleven "moved" by 1e-17. Points copied as they are compare exactly;
  joints, within a tolerance.
- **Match the reference, not only the textbook:** with the head's joint 3 cm ahead of the shoulders the ear was already
  over the shoulder's top (the plumb line of good posture), yet the neck's front, under the jaw, still leaned 17° where
  the user's reference leans about 8°, measured the same way on both pictures. 2.2 cm brought it to 14°, and the
  squeeze it adds under the chin looked smooth from below before the check's limit moved.
- **Give a long check its own time:** STUDIO takes about 50 minutes here; run under a 30-minute `timeout` it was killed
  at its 22nd step with nothing wrong. Run it with an hour and more, or by ONLY for the steps a change touches.


## The eye in a file (2026-10-26)

- **A stencil hides what depth shows:** the Studio draws an eyeball only through its opening, so it could stand up to
  3 mm proud of MHR's lower lid and nobody saw; exported, with only depth, it showed through the lids all round. Before
  carrying geometry from one renderer to another, find what a trick in the first one was hiding.
- **Move the soft thing, not the round one:** pushing the eyeball's points back behind the lids dented it in steps
  along the lid (each triangle across the lid line half pushed, half not). Real lids lie on the eye: bring the skin
  forward onto the eyeball and keep the eyeball whole.
- **Displace where a mesh's pieces meet, then blend:** lifting each corner of the cut skin on its own took the cut's new
  corners off their neighbours' straight edges, and a flat triangle between points lifted onto a sphere still dips under
  it in the middle (patches of eyeball under the eye). Lift MHR's own points, sample each triangle and raise it by the
  most it dips, and blend the lift into new corners like their positions.
- **A cut by a 32nd of a triangle still steps on a long sliver:** the shut eye's strip has triangles 20 mm long, and
  their pieces kept or dropped whole zigzagged the lid by half a millimetre. Cut the last pieces along the outline's
  own edge.
- **Smoothing a sharp corner can tie it in a knot:** MHR's own left inner corner, smoothed by Catmull-Rom, crosses
  itself; the even-odd cut counts the little loop as opening, and every character had a diamond of eyeball at that
  corner, in the Studio too. Check an outline for crossings; pull a small loop to where it crosses.
- **A body that misses its marks may miss them by definition:** the desk's check had a Studio body 6 to 7 cm off the
  blocking's head and hands, and the desk's own MHR body is off by as much (the previs skeleton's joints aren't MHR's).
  Measure the reference before setting a limit; compare against it.

## Iris patterns (2026-10-26)

- **Put a pattern beside its reference before measuring it:** the first sunburst was a solid blob with a jagged edge,
  the first lightning wandering cracks, the first crypts a ring of dashes. Each passed what a check would ask (the
  accent shows, it differs from the plain iris) and none read like the user's pictures. Rays need gaps, a taper and a
  colour running from root to tip; streaks run out from the pupil, nearly straight; crypts read as an iris only with
  the fine strands between them and a pale collarette.
- **A restarted machine keeps its files, not its servers:** after a reboot the test characters and MediaPipe's setup
  were still there but neither server was running. Check the ports before blaming a test.

## Anime lashes and the painted liner (2026-10-26, night)

- **A band "up from a line" breaks when the surface turns:** the liner was first painted as the skin within a liner's
  width up (the face's up) from the lashes' roots; on a shut lid, whose skin runs forward, that took a slab of the lid
  and showed its nine segments as flat plates. Bound a band by two lines found on the skin instead (the roots, and the
  skin a width out from them by rays): between two lines the distances to them add up to their separation, outside they
  add up to more, whatever the pose.
- **Check that the layer you're tuning shows at all before tuning it:** the liner at 1.0 with loud test colours showed
  only two specks at the corners, because the lid line it followed lies under the lashes and the eye's cut. A picture
  with every makeup layer at full strength in a colour of its own finds that in one look.
- **`out` is a GLSL keyword:** a float named `out` fails the whole skin shader (the Studio draws nothing but the eyes
  and the hair); the error names the line.
- **Hair is hairs:** lashes built as a few dozen cards of clumped strands read as solid wedges however they were
  clustered, and no amount of tuning the clusters fixed it; the user's reference is hundreds of fine hairs. One thin
  card per hair with a single soft-cored strand on it (its own atlas) looked right at the first render. Count the
  things in the reference before building them.
- **A helper's name taken by a setting:** the lashes' Criss-cross slider was called `cross`, the module's vector
  product too; renamed, the definition was missed and only the calls renamed (a regex on `cross(` doesn't match
  `const cross =`). Rename the definition first and let the syntax check find the calls.
- **Swing round the right centre:** the lashes' turn with a blink was first measured round the eye opening's middle (the
  outline's centroid, in the lids' plane): a lid that drops 5 mm past it swings 100° and the lashes folded into the
  cheek. The lids turn round the eyeball's middle, a centimetre behind: 31°. Anything that rotates with a lid pivots
  there.
- **A band of sparse strands shows what's under it:** the lash line drawn with the lashes' strand atlas (one soft hair
  to a cell) was mostly see-through, and skin showed between the roots. A root line wants its own texture: opaque along
  the edge, ragged only where it ends.
- **Check that a crossed card actually crosses:** the second lash card's width ran along the lash itself (the cross
  product of the first card's normal and the lid's tangent is the lash's own direction), a sliver that showed nothing
  from the side. The second card's width is the first card's normal.
- **Turn the root with the margin, the hair with the droop:** the extra droop a shut lid's lashes want was applied to
  the whole frame, rim included, and the roots swung below the seam onto the lower lid. What grows from the margin
  turns with the margin; only the hairs' own direction takes the droop.
- **Everything painted on a moving lid should take the same frame:** the painted liner found its lines by rays on the
  lid as it is now, which on a shut lid's bulge put a dark patch up the lid while the lashes (from the open lid, swung)
  sat at its edge. One frame for all of it: the open lid, swung with the margin.
- **A soft strand goes grey when it's small on screen:** the lash atlas's Gaussian core, mipped down to the few pixels
  a lower lash covers, spread its alpha over the whole card: a wide grey ribbon, not a hair. A strand that must read at
  a few pixels wants a solid core (alpha 1) with a texel of soft edge, and a tip that thins but stays black (the card's
  own taper makes the point); let the geometry taper, not the alpha.
- **The lower lid's margin faces up, the upper's faces down:** laying the lower lashes over their margin from the eye's
  edge (as the upper ones are, which hides the upper waterline the way a real face does) ran each lash toward the
  viewer and then down: an L from the front. The lower waterline shows in a real eye; root the lower lashes at the
  margin's front edge.
- **Hairs side by side are a comb, not a thicker hair:** a lower lash made of three nearly parallel hairs read as three
  thin lines with gaps, whatever their spacing. One hair, wide enough to cover a pixel and a half, reads as one lash.
- **Fading a measurement to nothing where it's unreliable puts the thing at zero, which is also wrong:** the rim the
  lashes lie over was faded to nothing at the corners because the search there picked the wrong skin; at zero the
  corner lashes rooted under the skin and the lower roots jumped to the eye's edge. Fix the search (square to the lid's
  own line, far picks dropped) and fill a gap from its neighbours; never fade to a value you know is false.
- **"Away from the centre" is not "out of the opening" at the ends of a slit:** from the eye's middle, outward points
  along the eye at the corners, where the margin still runs across the lid and a lash still grows across it. Square to
  the line, oriented away from the middle, is the direction that means out of the opening everywhere.

## Merging the eyes and the lashes (2026-10-26)

- **A check proved on a subset of steps isn't proved on the run:** the refraction step passed in every run of the eye
  steps alone and failed in the full run, after twenty steps had dressed the character (draped clothes, hair): with the
  cornea's coat off it still read a bright pixel in the iris, the frame most likely drawn before the shader that lost
  its coat had recompiled. It now waits for rendered frames and measures the eyeballs alone. Run the whole check once
  before calling a new step done.

## A test's root above the crown's top misses from a level view (2026-10-26)

The salon's radial field overestimates the head's radius at its pole (the top bins are filled from their neighbours),
so `COL.surface([0.03, 0.14, 0])` sits a centimetre above the skin. A camera from below (the reference's frames) looks
up through it into the head and the click lands; a level front view's ray passes over the crown and nothing is hit.
Three steps "failed" on it. Put a test's root where the view sees skin (the front of the crown from the front), and
when a click lands nowhere, check the ray against the mesh before the tool.

## Buttons over the view steal clicks (2026-10-26)

The salon's view buttons sat over the top of the view; a test's end click on the forehead, seen from below, landed on
"Side L" and turned the head instead of placing the sheet. Anything that floats over a canvas takes the clicks under
it: keep bars in the header or the panel, and keep only what must be in the view (the tools' column, OK by the arrow).

## The second reference's lash sets (2026-10-26)

- **A sculpt near an opening measures from the opening's own line, never from MediaPipe's ring:** on MHR's face the
  upper ring sits 2 mm below the line the eye is cut along, so Hooded lids, kept still for an eighth of the way up from
  the ring, still moved the opening's own vertices 0.3 mm and the lashes' rim with them. The sculpt is built now with
  the model's lid line (`buildSculpt({ lid })`) and nothing within 2.8 mm of it moves.
- **A height over a line is only as smooth as the line:** measured straight up from the lid's line, a point's height
  changed fast sideways where the line falls into the corners, and the fold turned twelve triangles over just above
  the outer corner. Measure from an envelope that can't fall faster than a set slope (its gradient bounded), fade a
  field out where it stops (no hard cut by depth or by the brow's gap) and count the triangles turned over.
- **Makeup under long lashes doesn't show:** the smoky plum looked grey-brown on the first render because its whole
  spread sat inside the 6.5 mm the glam lashes cover; sample the pixels where the colour should be before blaming the
  colour, and give a look the reach it needs (Eyeshadow size).
- **Measure the thing the style changes:** neighbouring hairs' lean differences barely told a criss-cross mink from a
  combed natural set (1.4×: the hairs in one cluster share a lean, so most neighbours agree); neighbouring clusters'
  mean leans did (2.6×).
- **A hard step in a makeup mask draws a line wherever the layer is still strong at it:** the eyeshadow's "above the
  lid's middle" and the wash's "nearer the lower lid" were steps; once the shadow spread wider they showed as straight
  lines across the skin beside the inner corner (found by sampling a column of pixels: a 20-level jump in one row).
  Ease every mask a layer can reach past.

## The clothes' edit mode and the designer collection (2026-10-27)

- **Radii carried round a middle that moved sink:** a shoe's heel cup took a forward section's radii as they were and
  blended the middles; on a tall boot the forward section's middle was 20 cm higher, so its radii round the heel's
  lower middle reached under the floor. Carry an outline as points and measure it again round the new middle.
- **A cropped top with long sleeves hangs lower than its hem:** the check measured a hem by the cloth's lowest point,
  and the sleeves' cuffs were lower. Measure a hem off the arms.
- **A shaft lofted from the foot cuts the calf:** the shoe loft's sections are planes along the foot, so above the
  ankle they wall off whatever lies behind the heel; a boot to the knee is cut as a shell with the shoe's line instead.
- **Lace with empty holes reads as see-through:** the reference's lace top was lined. An over-skin fabric needs an
  opaque twin (`laced`) for anything that isn't meant to show the skin.
- **A film on the body is the cheap preview of a cut:** the cutter's value on every skin point, drawn with its zero as
  the line, is a few milliseconds a garment and shows exactly what the tailor will cut; the cloth itself (relaxed,
  hung) is only for the bake.
- **A cut that hugs the body reads as knitwear, whatever the fabric says:** every structured garment looked like a
  cardigan until the cut bridged the hollows (more tension), the shoulders were built (a pad at each joint) and the
  drape kept the cut (memory, stiff bend, little slack). Fabric tiles can't make a membrane look tailored.
- **Judge a tile on the garment, not the swatch:** lace flowers at 7 cm were polka dots on a blouse, silk streaks were
  creases down a skirt, a satin sheen band tiled into blocks. Render the outfit before calling a fabric done.
- **"Loose" is not "open":** a blazer loosened by its fit still closed down the front and read as a long cardigan; the
  reference wore it open. Cut what's worn open open, and let the drape leave it so.

## What a shader draws never reaches a file (2026-10-27)

The Studio's skin, clothes and lashes looked right in the Studio and came out white on the desk: their colours were
drawn in shaders (`onBeforeCompile` uniforms, a `ShaderMaterial`), and glTF carries only a material's colour and maps
(GLTFExporter drops a ShaderMaterial without a word in the file). Check an export by reading it back and measuring what
a plain viewer would draw (STUDIO's export colours step), never by the Studio's own view. Anything new drawn in a
shader needs its bake (`albedo.js`) before it ships.

## A close-up says its size, and the check plays every answer that matters (2026-10-27)

The writers' room's first builds passed the story check and failed SHOTS: the plan's shot review frames a clip's whole
body unless the clip says its size, and an actor on a mark 0.65 m from the eye shows only a quarter of a standing body.
A first-person close-up names its shot (`mcu` at 0.55 to 0.9 m, `cu` closer) so the review frames the head and
shoulders, and its mark stands straight ahead of the eye (a mark offset sideways put the face 0.97 m away, an MS). And
the walker answered every reply by its sweep (the kindest, the cruellest, silence), so an ending decided by a middle
answer was never reached: a reply whose answer sets a flag a flag choice reads now plays each such answer on its own
path. Build a generated game through all of check_all (STORY, LEVEL, SHOTS) and the desk's own suites, not only STORY.

## A redraw on the first click eats the double-click (2026-10-27)

The writers' room's chart picked a shape or an arrow on mousedown and redrew it, so the element the first click landed
on was gone by the second: the browser's dblclick never came (an arrow couldn't be labelled, a shape retitled). Read a
double-click from the second mousedown (`e.detail >= 2`). And an autosave that redraws mustn't run over a title being
typed on the chart (the redraw replaced the element being typed in: `editing` holds it off); a blur that follows an
Enter must not finish the same edit twice. Test an editor through the gestures a person uses (a double-click, typing
after a drop, a box dragged with Shift held) in the view as it is after the steps before (a step that centres the view
moves what the next one aims at), not only by calling its functions.

## A wait in a browser test is counted in the slowest frames (2026-10-27)

PLAY's bed step failed twice at the same place ("not lying down", the eye at 0.71 of a 0.69 target): the lie-down is a
1.1 s tween that moves at most 0.05 s a frame, and a software GPU late in the run draws about two frames a second, so
it needed some 8 s of real time and the step waited 8. Nothing was broken. A test waiting on anything the frame loop
drives (tweens, fades, cards) gives it the run's slowest frame rate: 60 s, as PLAY's other steps do.

## A step late in a browser test may be in a new run (2026-10-28)

PLAY's pause-menu step expected the flashlight's row (picked up a few steps earlier) and found it missing: by then the
test had started a second playtest (the one that checks a new run starts from the story's level), and a new run starts
with nothing in the pocket. The menu was right. Before asserting what a step "already has", check whether a step since
began a new run; give the step what it needs itself (here `give("flashlight")` before the menu opens).

## An Esc sent to skip a scene can pause the play after it (2026-10-28)

PLAY skips the Watch's scenes by pressing Esc until play is back. Once (third run of the day, the step had passed twice)
the last Esc landed after play had resumed: on the software GPU's slow frames it arrived more than the runtime's 400 ms
after `go()`, so it was a pause, and the next step found the menu up. Nothing in the game was wrong. A test that sends
keys to get past something must check what its last key did once it's past (`scenesUntilPlay` now closes a pause it
opened), not only that it got there.

## Two browser suites at once, and a suite cut in half (2026-10-28)

STUDIO failed twice on the Character Studio's reference light, neither time because of it. The first run was cut off
at 23 of its 38 steps by the timeout I gave it (28 minutes: the whole suite takes nearly an hour on this box's software
GPU). The rest, run on their own with `ONLY` while PLAY ran beside them, timed out on a click whose element was already
visible and still: two headless browsers drawing WebGL on four cores starve each other's input. Run alone, the same
subset failed on the eyes: that step checks a face fitted to pictures, which two earlier steps (the front and side
pictures) make, and `ONLY` had skipped them. So: one browser suite at a time; a suite's timeout over its whole length
(STUDIO an hour); and `ONLY` only for steps that stand alone, else the whole suite.

## A count over a short window isn't a rate (2026-10-28)

PLAY's footsteps step compared the steps heard in 1.6 s walking and crouched and wanted fewer crouched. Both were
three: the first step comes half a stride in, so a short window rounds both rates to the same count. The steps were
right (0.52 s apart walking, 0.65 s crouched). Measure what's meant (the time between steps, from the game's clock),
not a count over a window that small.

## The stage's cast are figures, not objects (2026-10-28)

The cast's footsteps heard nothing on their first PLAY run: `stage.cast[id]` is a figure (its body, its head, its
motion), and the Object3D that moves through the room is its `.group`; the code asked the figure for `visible` and a
world position and skipped her. The runtime's `shelfSound` had made the same mistake since it was written, so a sound
placed at a cast member played from nowhere in particular. Anything that wants where someone is asks
`stage.cast[id].group` (or `headWorld()` for the eyes' height).

## A new way through a lock must leave the story's locks alone (2026-10-28)

The latch's first PLAY run found the front door's turn saying Unlock before anyone had turned it: the Pilot's arrival
slams the front door and locks it behind you (`door` `lock`), and a thumb turn that undid any lock would have let the
player walk straight out of the story. The latch now keeps its own lock (`latched`) apart from the door's: it locks and
unlocks only what it locked, and against the story's lock or a key's it won't turn. Anything new that opens, unlocks or
moves past something should first ask what else already holds it shut, and leave that alone.

## The key that closes a card keeps going (2026-10-28)

Putting the examined photo back with Esc paused the game straight after. The HUD's Esc handler (a capture listener,
first to run) closed the card and resolved its promise; the runtime's `modal` then set `busy` back to false in a
microtask, which runs between listeners, so by the time the same keydown reached the runtime's own handler the game
was no longer busy and Esc meant pause. Text cards closed with Esc did the same; the tests had always closed them
with the button. The runtime's guard for "an Esc meant for the scene that just ended" (`since`, 400 ms) now starts
when a card closes too. A key that ends one thing must be checked against everything else listening for it.

## A test that touches the story's things can change its ending (2026-10-28)

PLAY's new examining step looked at the Pilot's kitchen photo, and twenty steps later the walk out onto the porch
ended in "Mother's day" instead of the good ending: looking at that photo is the Pilot's secret (`found_photo`). The
step itself was fine. Before a test step uses one of a game's things, check what the story hears from it (`story.py
flow`, a grep for its id); use one nothing listens to (the answering machine), or give the step a thing of its own.

## An import inside a function hides the module's name everywhere in it (2026-10-28)

The desk's "saves kept" list (the toolbar's clock) had failed since 2026-10-26 without anyone seeing it: two branches
of the server's `do_GET` had their own `import urllib.parse`, which makes `urllib` a local name for the whole
function, so the history branch (on paths those lines never run) found it unbound, raised, and the server dropped the
connection. GUIDE's history step was the first to notice. The module imports it once at the top; a function never
imports again what the module already has.

## A second level at the same coordinates found the checks comparing across maps (2026-10-28)

TestRoom001 is the first game with two levels, and its annex sits at the lab's own coordinates (each level is its
own map, in Unreal and on the desk's stage). The level check then put the lab's cornices "3 cm into a wall of
annex_hall", and the shot review found an annex camera "inside corridor__wall_e4": both compared every piece with
every wall, whatever its level. Whatever compares two pieces compares them on one level; a new kind of story (two
levels, a set, a second floor) is worth one run of every check before trusting what they say about it.

## The reticle reaches a door from either side, so a test must say which side (2026-10-28)

TESTROOM's walk through the front door went the wrong way: the helper that stands the player where the cursor lands on
a thing tried the side north of the door first, and a door is in its wall's plane, so the reticle found it from the
lobby too. Walked "through" from there, the player went out into the yard. Through a door, a test stands on the side
away from the room it wants and faces it (`walkThrough(door, into)`), never where a search happened to stop.

## A station's last tick clears its list at once (2026-10-28)

The latch locked the front door, its task ticked, and the test waiting to see it ticked on the HUD never did: the
station's own `done` (`untodo` then `done`) had cleared the list in the same moment. A test hears what the story hears
(the runtime's events: `{type: "todo", id, state}`), not what's left on the screen afterwards.

## The software GPU and a big level: draw only what can be seen (2026-10-28)

Play in TestRoom001's lab ran at one frame a second in the headless browser (24 lights over 565 meshes, half a second
a frame with every light lit per pixel; the Pilot runs at three), and the game's clock moves at most 0.05 s a frame, so
a 40 s station took ten minutes. A smaller window or the simple view alone barely helped. What did: the simple view
leaves out the rooms the eye can't see through any opening in view (their props, floors, lights; never walls or
doors), thirty frames a second, the pictures the same to the pixel. Measure where the time goes (a render read back,
then with lights off, then far things off) before reaching for a fix.

## A list that's through before it's whole (2026-10-28)

TestRoom001's power station ended the moment you walked in: walking in ticked its first task ("Go into the power
room") and fired the beat that cut the power and put the other three tasks on the list, but Play ran a beat's actions
one awaited step at a time, so the station's `{"ticked": true}` beat heard the same event first, found a list of one
ticked task, and ended it. The story check never saw it (its walker runs a beat whole). Play now runs a beat's
instant actions together before the next beat looks (STORY_FORMAT §4), and the test room puts each station's whole
list on at its start, its later tasks ticking only once their moment has come (`all` with a flag). A `{"ticked": true}`
station needs its list whole before any of it can be ticked.

## The last tick cut its own beat off (2026-10-28)

TestRoom001's sofa and locker: "Sit on the sofa" ticked on `use: rest_sofa`, the same event that started the sofa's
beat (a scene, then the name box); the tick was the station's last, so the station ended there and the name was never
asked. The locker's "Hide in the locker" did the same to the look-away swap, and the run went on through the next scene
and the round's card while the test was still waiting in the locker. A station ends when its list is through, so the
task that closes it ticks at the end of the beat it's about (`{"tick": id}`), never on the trigger that starts it
(STORY_FORMAT §4); the story check now warns about it. The bed did it too, and so did the fuse, whose beat only slams
a door: there Play was wrong, the to-do list heard the pickup before the beats did, so the list ended the station
before the slam. Beats hear an event first now. The same day: a kit door's frame is a block spanning the doorway,
drawn only at its edges, and it caught the reticle, so a kit door couldn't be opened from its middle; Play's aim now
passes through hollow pieces.

## A retry with empty pockets (2026-10-28)

The full TestRoom001 run failed at the annex's fusebox ("Needs: Fuse") though every station alone passed: the death
in the round and its retry ("Return to") restarted the run from the round's checkpoint, and a checkpoint kept flags,
karma and counters but not the items or the little things' states, so the fuse from the vault was gone. A start
`--from` a station is given what the stations before it leave (LEAVES), so it never showed. A checkpoint keeps the
pocket and the little things now, and the test checks them after the retry. Run the whole room from the start before
calling it done: what one station leaves the next is only tested there. The full run's clock showed one more: the
kitchen's cigarette, lit from the start, burns seven minutes and keeps what it burnt (`keep`), so by the time a whole
playthrough reached the kitchen it was out for good and there was nothing to put out. A little thing a station is
about starts there (unlit, and lit as you come in).

## A number that belonged to one character (2026-10-28)

PEOPLE checked a Studio export's eye on the desk by its white being over 120 of 255. It passed for months on the export
the last full STUDIO run left behind; once a shorter STUDIO run left a fresh default character's export there, the white
came out 118 (with the skin light on or off: the eye isn't the skin's), and the check failed on a healthy eye. How light
a white is belongs to the character's paint and the light; the check now asks what makes an eye an eye: the pupil
dark, the white's lightest clearly over the lids' mean beside it (118 against 93). A test measuring a picture compares
parts of the same picture, not a number tuned on one run's leftovers.

## One budget for six walks (2026-10-28)

The story check walks a game six times (the kind, the cruel and the silent player, each missing every secret and then
finding them all), and all six shared one cap of 4096 paths. A conversation card whose answers go different ways (the
end, another card) multiplies the paths after it; in the Sample with one four-answer talk the first five walks took
759 each and the last, the silent player who finds the secrets, was cut at 301, silently: what it would have found
past that went unchecked, and an ending only it reaches would have read as unreachable. Each walk has its own cap now,
a walk cut short says so, and an ending no walk reached is an error only when nothing was cut. An answer is walked on
a path of its own only when its way differs from the sweep's (another card, or replies and events it skips); a skip
over plain lines is only time.

## Look at what fills a hole before reshaping it (2026-10-28)

The Studio's eyes vanished seen from the side. The eyeball is drawn only where a fan over its opening marks the
stencil, over whatever is inside the head (no depth test), and from the side that fan is nearly edge-on, so the first
two fixes widened where the eyeball may show: drawn again as a solid inside the opening's outline, then a fan domed
over the cornea. Each made the eye bulge out of the lids, which the user didn't want, and neither touched the cause.
Rendering the opening with its eyeball hidden and the fan coloured green showed it: from 75° the opening was full of
an eyeball all the same, the other one. Both eyes wrote the same stencil value, and seen from the side they line up,
so the far eyeball, drawn after the near one with no depth test, painted itself through the near opening; and where
the skin is cut deeper than the fan, a grazing ray slipped past the fan into the head and onto the other eye's. Each
eye has its own stencil value now, its fan is walled back to the cut and writes depth. Only then was the shape worth
working on: the user drew the mask they wanted (red, over our renders), and the fan became that mask made smooth, an
arch from lid to lid. When something drawn looks wrong, take parts away one at a time (colour the mask, hide the
object) and see what's left, before changing the shape of anything.


## A browser check in the cloud wants the machine to itself (2026-10-28)

The full STUDIO run failed 30 steps in: a click on the Head view's button timed out after 30 seconds. Nothing was
wrong with the page; the picture the failure left shows the button right there. CHECKS, DESK, CMDS and REFS were
running beside it on the cloud's four cores. SwiftShader already spends about a second on a frame there, and
Playwright's click waits for the button to hold still over two frames, so with the cores shared the wait ran out. The
same steps passed when the run had the machine to itself. In the cloud, run nothing heavy beside a browser check, not
even the offline ones. On the user's machine, with `GPU=1` (docs/RUN_LOCALLY.md), a frame is milliseconds and this
doesn't arise. Confirmed 2026-10-29: TESTROOM's typed-thought check went red twice in the cloud, once with nothing
else running, and passed first time on the 3090 in 3.2 minutes with the rest of the suite running beside it; the
thought's typing is paced by the clock and SwiftShader's frame was slower than a letter. A browser timing check that
fails only in the cloud is read on the card before anything is changed.

## A spot light projects only through its shadows (2026-10-29)

A SpotLight3D with a `light_projector` lit nothing: the wall under it went dark, with any texture, even plain white.
It lights again the moment `shadow_enabled` is on. Godot's projector sampling rides on the spot's shadow atlas slot,
so without shadows there is no projection and the light's whole contribution goes with it. HSPattern switches the
spot's shadows on itself and says so. Measured in the plugin's own project (`Saved/Godot/_lookplugin/`), five runs of
a ten-line scene: when a light does nothing, try it bare (no projector, no pattern) before suspecting the pattern.

## A projector that changes every frame doesn't show (2026-10-29)

The first HSPattern drew its caustics into a SubViewport each frame and made the ViewportTexture the spot's
projector. The renderer copies a projector into its atlas once, when it's added, so the light showed one frame of the
viewport, or nothing. The loop is drawn once at load instead, a frame a frame into plain ImageTextures, and the
projector is swapped among them (each copied into the atlas once). Anything the renderer atlases (projectors,
decals) wants a texture that stands still.

## A chain that waited for itself (2026-10-29)

A background chain began `until ! ps -p $(pgrep -f "lookshot.gd" ...)`: the pattern matched the chain's own shell,
whose command line held the words, so it waited forever, and three chains queued behind its logs waited with it.
CLAUDE.md's rule about `pgrep -f` and `pkill -f` covers `until` loops too: a chain that waits for a process should
wait for its log's last line, or for a PID taken from a variable, never for a name that is also in its own command.

## A Godot check that measured a different renderer and a different window (2026-10-29, the local run)

The first LOOKPLUGIN run on the 3090 came back with ten red rows and no error. Two things had gone wrong at once,
neither of them the plugin. First, the check set `VK_ICD_FILENAMES` to the cloud's lavapipe driver file, which doesn't
exist on the user's machine; the Vulkan loader then found no driver at all and Godot fell back to OpenGL, with a
warning in its output the check never read: no SSR, no volumetric fog, no compositor effects, no auto exposure, so the
wet floor, the shaft, the softener and the iris measured the same on and off. Second, with a display, Godot opened a
real window and Hyprland tiled it to 941 × 1030, so every measure's pixel box fell on another part of the picture (the
oil sphere's glint box measured a black pool). Now every Godot script sets the lavapipe ICD only when that file
exists, fails on Godot's "switching to OpenGL 3" line, prefers Xvfb whenever `xvfb-run` is there (the card still draws
through Vulkan under it, and no window manager touches the window), and the check projects are `resizable=false`
(a tiling manager floats a fixed-size window). The plugin check runs with `--fixed-fps 60`, so a stage's frame counts
mean the same seconds on the card as in the cloud. Two rules: a check that measures pixels must first assert the
renderer and the picture's size it measured in; and a stage that passed alone (`--only`) but not in sequence
(the sweep: its beam never crossed the camera's view, the alone run had another camera) was passing by accident.

## A browser check that passed only because the cloud was slow (2026-10-29, the local run)

PLAY went red three times in a row on the 3090, each time one step further, and each red was the check's own pacing,
not the desk's: the name box takes focus 30 ms after it appears and the card typed before that (the thought then said
the placeholder's name); after a crouch the eye rises over a second and `goTo` aimed from where it still was, so the
first tick after carried the reticle off the small thing; the kitchen's glimpse beat shows its thought 1.4 s after the
room's edge and the step looked 1.37 s after it. On SwiftShader every one of these had been hidden by the slow frames.
The fixes are in the checks (wait for the box to have the keys, for the eye to settle, for the beat's own time) and
one in the HUD (the box focused at once as well as after its timer). The rule: a wait in a browser check is for a
state the page can show (focus, a settled value, the clock past the beat's own sum), never for a frame count or a
guessed margin; and a check that only ever ran on a slow machine hasn't been run.

## A lightmap bake that worked by hand and baked nothing from a fresh export (2026-10-30)

- **The editor's file system has to know a folder before a bake writes into it.** LightmapGI's bake writes each
  light texture (`<data>.exr`) and asks the editor to import it; a folder made after the editor's startup scan isn't
  in its tree, so the import fails (`Can't find file ... during file reimport`, then `BAKE_ERROR_CANT_CREATE_IMAGE`)
  and the data comes out with no meshes. The export makes `game/lightmaps/` (with a README, so a zip keeps it), and
  the bake plugin rescans the file system if it ever has to make it.
- **The editor writes a LightmapGIData only at a scene save or at quit.** A level baked for several states (the times
  of day, the lamps on and off) on one LightmapGI would keep only the last; the plugin saves each state's data with
  `ResourceSaver.save` right after its bake.
- The story: the hand run baked 473 meshes because an earlier run had already made the folder; the first GDBAKE from
  a fresh export baked twice and registered none. The annex (a ten-second bake) was the quick test bench.

## Tool nodes in Godot's editor save, notify and instance by their own rules (2026-10-30)

- **Nothing added or freed inside a notification sent down the tree.** The pre-save and post-save notifications
  come through `propagate_notification`, which holds every parent busy while it runs: a leak node freeing its drips
  there failed ("Parent node is busy") and crashed Godot. Restore what's saved (a material, an energy) right away;
  free with `queue_free` and build again with `call_deferred`.
- **`EditorInterface.save_scene()` runs frames while it saves** (its progress bar): an EditorPlugin's `_process`
  that called it ran again inside it and saved again ("Task 'save' already exists", then an abort). Mark the save
  started before calling it, and return early while it's busy.
- **A plain script can't be instanced in the editor**, only its static functions called: a `@tool` node making an
  `HSRain.new()` needs `rain.gd` to be `@tool` too.
- **`surface_get_name` is ArrayMesh's alone**: a helper that matches surfaces by name must skip it for a
  primitive mesh (a SphereMesh stood in for a body and the skin's `wear` stopped there).
- **A detail tile's size is metres of skin, not UV units.** HumanShaders' micro tile at 30 a UV unit was made for a
  head that fills its UVs; on MHR's shared layout (0.72 m a UV unit on the head, 1.9 on the body) it lay 2.4 cm a
  repeat on the face and 5.7 on the shoulders: the user's "pores way too large". Measure the layout's metres (area in
  3D over area in UV, per triangle) before choosing a scale, and keep one scale an island (a scale that changes
  across the skin squeezes the pattern where it changes: `uv * s(uv)` has `uv * ds` in its derivative).
- **A visible pore is 0.15 to 0.35 mm across**, not the 0.6 mm between follicles: the first tile's 0.09 mm pits were
  under a pixel at a close-up's 0.12 mm and nothing showed. Size a feature by what a camera sees at the shot's pixel.
- **Godot's screen-space scattering blurs the finished colour, paint and detail with it.** HumanShaders' strength (1.3 to
  3 within a metre of the eye) turned a face to wax and hid every pore the detail layer drew; picture a skin change
  with the scattering off once (`portrait_check.py --sss 0`) before deciding the detail is too faint.
- **Paint a shader's coordinates before trusting a direction.** The eye's layout runs +y down the eye, so the "upper
  lid's" shadow first fell on the lower lid; a debug grid (`fract(eP.xy * 2)` as the colour) showed it in one picture.
- **Godot's glTF importer lights an emissive texture** although glTF's emissive colour is black when it's left out:
  the salon's strand numbers parked in the emissive slot glowed as rainbow hair wherever HSHair wasn't on (the editor,
  GDPEOPLE's flat picture). Data rides in the occlusion slot, which only shades the ambient.
- **Godot's importer drops an unlit glTF material's vertex colours**: the salon's darkened scalp (its colour by vertex,
  unlit) showed as a white cap at the parting and the hairline in every game. An unlit material's colour goes in its
  base colour; the vertex colours carry only what can be lost (the see-through).
- **Name matching meets the character's own name**: `_hairbefore_skin` was taken for hair and `_hairbefore_eye_L` with
  it. A Studio export's parts are matched by their suffix first (`_skin`, `_eye_`), the words after.
- **A dithered coverage thins a strand narrower than a pixel to nothing**: the lashes vanished under the hair's hashed
  cut. Hairs lying on the skin keep the soft scissor.
- **Measure one part with the others out of the picture**: the pores' close-up started measuring the hair once a long
  cut fell into it (the grain ratio 1.16 instead of 1.76); the portrait hides the hair for that shot.

- **Shell normals on double-sided cards need the winding to agree.** A viewer turns a back face's normal round (three.js,
  Godot's own materials): with every card's normal the hair volume's, the cards wound into the hair lit their outside
  with a normal into the head (dark) and the rest caught the room's reflection as one grey sheen; the Studio's view of
  the new bake was worse than the old one while Godot's HSHair (both faces lit by the vertex normal) looked right. Wind
  each triangle toward its normal (`hairvolume.js` `wind`), and look at a change in every viewer that shows the file.
