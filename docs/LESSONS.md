# Lessons

What each bug that took more than one try taught us: the rule, then the story in a line. Add one before pushing
the fix.

## Carried over from the Godot project (Woohill)

- **Measure, don't guess:** a check that prints one `<NAME> ok` line beats any amount of reading code. Every
  system gets one, and `tools/check_all.py` runs them all.
- **Keep context small:** summaries and tails, not whole files and logs. Contact sheets, not frames.
- **Small steps, pushed:** the user changes course quickly, so every step should stand on its own.

## This project

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
