# The salon: hair drawn by hand on the head (the plan)

The user's call (DECISIONS 2026-10-22, "the salon"): the Gaussian splat route (docs/GSHAIR.md) was worth testing and
isn't good enough. Hair is made in a **virtual salon** instead: the head (or the whole clothed body) is there, a rough
3D guide from the orbit video floats round it, and the user draws the hair onto it as **vector locks**, the way
Blender's hair curves and Illustrator's pen work, but far easier. Stylised options for most of it (a lock is a sheet or
a bundle, never strand by strand), realism options where wanted. The locks get physics only where the user says, never
clip into the body or clothes, and the look is filled out with **fake volume** (a scalp cap with thickness) rather
than more hair. Eyebrows and eyelashes are variations of the same tool. The goal, in one line: **easier than Blender.**

This file is the work list, in build order, for the session that executes it. Tick as you go; one step per commit,
pushed; every page gets a headless test that ends `SALON ok`; write the lesson in docs/LESSONS.md when something takes
a second try. Read docs/DECISIONS.md and CLAUDE.md first.

## The player's path: the first five minutes (the user's note before handing over)

The salon has to be so easy that a layman gets going without reading anything, and it should feel like playing a
character creator, not using Blender. The objective is not fine-tuned hair: **a photo or video reference, the rough
shape achieved, single strands ignored, and it looks good**, Japanese and other East Asian styles first. Manual is
fine; tedious is not. The rules that follow from that, which every phase below has to obey:

1. **Never a blank head.** The salon opens on a wall of cuts (cards with pictures: hime, see-through bangs, curtain
   bangs, layered bob, wolf cut, two-block, half-up, low pony, twin tails, bob, long straight, long wavy). One click and
   it's on the head, moving. Everything after is adjustment.
2. **The reference is in the room.** Drop a photo or a video; it sits beside the view, and can be laid over the head
   half-transparent, matched to the head's angle. A video is the better reference: it becomes the **locked
   reference** (below): wherever you turn the head, the frame shot from that angle is laid over it, so the overlay is
   right from every side, not only front and side. A video that only reaches the side is mirrored onto the other
   side. Photos are the fallback: front, side and back, each told which it is. You draw against it.
   **Mirror** is a toggle: with it on, a lock placed on one side of the seam appears on the other too, and stays its
   twin until you break the link; the seam is the middle of the head by default, or your own.
3. **Tracing is the main act.** In the front, side and back views you trace the hair's **outline** over the reference
   with a lasso, like tracing on paper; the hair's outer shape stretches to the trace (the locks scale and move so
   their outline matches; the inside follows). Three traces and the rough shape is there. No lock needs touching for
   this.
4. **Then the parts that make a cut a cut**, each a gallery with pictures, not a slider: the fringe (blunt hime,
   see-through, curtain, side-swept, wispy, none), the sidelocks (hime chin-length, face-framing, none), the parting
   (middle, side, none), tails (twin, pony, half-up, buns), the length (shoulder, chest, waist), the volume (flat,
   airy, big). Picking one swaps those locks and keeps the rest.
5. **Handles, not numbers.** When a lock is touched, it has three or four handles (root, middle, tip; a sheet's
   corners) you pull like clay, big enough to hit, snapping off the head. Sliders say words (short to long, straight
   to wavy, thin to thick, neat to messy) with a preset dot, never a value that needs explaining. "Lock", "fringe",
   "sidelocks", "tail" in the UI; "curve", "guide", "lattice", "node" nowhere.
6. **It moves while you work.** The head idles (a slow turn and a breath), a Shake button, the game's lights and a
   "How it looks in the game" button (the POV medium shot). Jiggle is a tick on the fringe, the tails, the long
   locks, with stiff/soft/floppy, tested by Shake, and it is the last step, not the first.
7. **Undo everywhere, autosave, no waiting.** Every click is instant; nothing trains or bakes until Save. "Surprise
   me" makes a variation of the current cut (lengths, volume, fringe) for people who'd rather pick than shape.
8. **Colour and shine as a gallery too**: black, dark brown, ash, chestnut, with or without a lighter tip, and the
   anime option: a stylised shine band across the hair instead of the realistic highlights.
9. **Photo mode**: a screenshot of the head beside the reference, the proof it looks right.

The order of the salon's panel is the order above: Cut, Reference, Trace, Fringe & Sides, Shape (handles), Colour,
Move (jiggle), Save. A newcomer goes top to bottom and is done; an expert jumps.

## What exists to build on (reuse, don't rewrite)

| Piece | Where | Reuse for |
|---|---|---|
| The Studio's body: MHR from presets or a character's weights, scaled to a height | `tools/character/hairbuilder.html` (`loadMHR`, `buildHead`), `index.html` | the head and body in the salon |
| The scalp and the head's frame from MediaPipe's landmarks | `tools/character/hair.js` (`scalp`, `frame`), `gshair/common.py` (`scalp`, `HeadField`) | where roots may go, the hairline, the cap |
| Spring chains pinned at the root, gravity, hold to a rest shape, damping, pushed off the head and body | `tools/character/wig.js` (`Wig`), `splats.js` (`headPush`) | the locks' physics |
| Ribbons with a strand alpha texture, drawn from polylines | `hair.js` (`ribbon`, `strandTexture` in `index.html`) | drawing a lock as a sheet |
| GPU strands rebuilt from guide chains, the Kajiya-Kay hair shader | `tools/character/strands.js` | the realism option: strands interpolated inside a lock |
| The clothes on the body: a draped garment mesh per design | `tools/character/clothes.py`, `drape.py`, `api/clothes/<name>/<design>` | collision so hair sits on clothing |
| A rough 3D guide from an orbit video: the keyed frames' visual hull (no training), the orbit poses | `gshair/masks.py`, `gshair/poses.py --orbit`, `gshair/splat.py` (`hull`) | the translucent guide round the head |
| The splat itself, cage, paint | `hairbuilder.html`, `hairsplat.js`, `lattice.js` | optional reference layer only; not the product |
| Body collision as slices, the head as a radial field | `gshair/export.py` (`body_slices`), `splats.js` (`headPush`) | fast push-out for the locks |

## Phase 0: research Blender's hair, then design (one session, no code yet)

- [x] Blender's source read from GitHub (the raw files; no clone needed): `main` for the data model, the add step,
  the constraints and the simulation; the `v4.2.0` tag for the sculpt brushes (they moved after 4.2). **The user's
  call: port Blender's functions freely (an in-house tool for free games); keep Blender's names; the files that carry
  ports say "Ported from Blender (GPL-2.0-or-later)" in their header and THIRD_PARTY.md has the row.**
- [x] Read how **hair curves are stored and edited**: `source/blender/blenkernel/intern/curves_geometry.cc` (control
  points, Catmull-Rom and poly curves, per-curve attributes), the sculpt-curves brushes in
  `source/blender/editors/sculpt_paint/curves_sculpt_*.cc` (add, comb, snake hook, grow/shrink, pinch, puff, smooth,
  slide; how the root stays on the surface: `curves_sculpt_add.cc`'s surface sampling and `slide`'s re-projection).
- [x] (from the code they lift from and memory; the manual was unreachable: verify in Blender) Read the **procedural hair node groups** (the asset file `release/datafiles/assets/geometry_nodes/`
  `procedural_hair_node_assets.blend`; its node trees are documented in the manual's "Hair Nodes" page): Interpolate
  Hair Curves (children from guides), Clump, Frizz, Curl, Roll, Hair Curves Noise, Shrinkwrap (off a surface),
  Smooth, Trim, Set Hair Curve Profile, Duplicate Hair Curves, Attach Hair Curves to Surface. Write down the inputs
  each takes and the few that matter for us: interpolate, clump, curl, shrinkwrap, trim, profile.
- [x] Read the **hair simulation**: the old particle hair dynamics run on the cloth solver
  (`source/blender/blenkernel/intern/particle_system.cc` → `cloth.cc`, `implicit_blender.cc` /
  `BPH_mass_spring.cc`): structural springs along the strand, bending springs, a mass per point, damping, collision
  with collision objects by a depth, and "pinning" by vertex-group stiffness. Note what we keep (springs along and
  bending, pin at the root, collision push-out, a stiffness falloff from root to tip) and what we drop (implicit
  integration, self-collision, the cloth coupling).
- [x] Written: `docs/research/blender_hair.md`, with the maths ported to JavaScript and a table of what goes where. Was: write `docs/research/blender_hair.md`: the data model, the brushes and what each does in one line, the node
  groups and their inputs, the sim's forces and constraints, and **our lighter version**: Catmull-Rom locks, verlet
  chains (wig.js) with a bending constraint, root pinned, collision by push-out against the head field, body slices
  and a garment proxy, physics only on marked locks.
- [x] Decide the **lock types** and write their data model in `docs/STORY_FORMAT.md`? No: hair isn't story. Put it in
  `docs/SALON.md` (the salon's own doc, started in this phase, grown through the build):
  - `strand`: one curve, root to tip (the Illustrator line).
  - `sheet`: a root **line** on the scalp and an end **line** in the air; the surface between them (a ribbon of
    width); the ends' spread set with the scroll wheel while placing.
  - `bundle`: a root line (or a root disc) and a tip point: a tapered cylinder (wide at the root, gathered at the
    tip, or the reverse); its outline points shape it.
  - `cap`: the scalp cap (fake volume): the scalp triangles chosen, a thickness, a pore texture.
  - `brow`, `lash`: short strands placed from presets along the brow landmarks and the lid outlines.
  Each lock: an id, a name, a group, visible, a colour or the head's hair colour, `physics: {on, pin, gravity, hold,
  damping, collide}`, `style: {realism: 0..1, strands (the realism option's count), width, taper, curl, frizz}`,
  and its control points in the body's frame (metres, Y up, facing +Z), roots as (triangle, barycentric) on the
  scalp so they move with the head's shape. `animation: {clips: {}}` reserved (the animation refiner).
  **Done 2026-10-22**: strand, sheet, bundle, in docs/SALON.md (The file).
- [x] Decide the file: `Content/Studio/Hair/<name>/salon.json` (tracked; the user's hair is theirs), beside the
  splat presets. Thumbnails `thumb.png`.

## Phase 1: the salon page, the head, the guide (the shell everything hangs on)

- [ ] `tools/character/salon.html` + `salon.js`: the Studio's look (dark, side panel, orbit by drag, wheel zoom), a
  base body or a character (reuse `buildHead`), the game's lights, a POV button (the player's eye at MCU distance,
  the 90° lens in a 16:9 frame, as the Studio's POV view).
  **Built 2026-10-22** with MHR's body presets and a height; not yet: a character's body (People), the game's lights, the POV button.
- [ ] The body as **collision proxies**: the head's radial field, the body's slices (port `body_slices` to JS once,
  in `collide.js`), and a garment proxy when a draped garment is loaded (`api/clothes/<name>/<design>`): a voxel
  occupancy of the garment at 1 cm plus its surface normals, `push(p, gap)` → `[q, moved]` like `headPush`.
  **Built 2026-10-22** in `salonlib.js` (`Collider`): the head's radial field above the chin, the torso's slices every centimetre with the arms left out, `push(p, gap)`; not yet: the garment proxy.
- [x] The **locked reference** (the video as a 3D reference, the user's ask 2026-10-22): the orbit video's frames
  with a camera per frame **in the head's space**, so that turning the salon's view turns the reference with it.
  - The backend exists: `gshair.py frames` picks the frames, `masks` finds the face landmarks, `poses` gives a camera
    per frame (face PnP while the face shows, `--orbit` for the rest and for a faceless mannequin head, where the
    user marks the front frame and the sweep), and `common.head_frame` + `mhr_scale` put those cameras on the salon
    head (the face's height sets the scale; a mannequin's "front" frame and the orbit prior set it otherwise). A new
    step `gshair.py reference --out DIR` writes `reference.json`: per frame its camera (R, t, K) in head space, the
    frame file, the keyed frame file; nothing trains.
  - In the salon: **the camera snaps to the frames.** With the reference on, orbiting the view picks the frame whose
    camera is nearest to where the user is looking and moves the view camera onto it exactly (same position, look
    and focal); the frame (keyed, so only the hair and head) is drawn as a half-transparent full-screen layer and
    lines up with the head. The wheel scrubs frames (or orbits as usual with the reference following: ~90 frames
    over a turn is under 4° between them, so the nearest frame is always close). An opacity slider; a tick to show
    the unkeyed frame; a filmstrip.
  - **Partial sweeps**: the user says how far the video goes (a full turn, front to side, front to back); for an
    angle the video never reached, the frame from the mirrored angle is flipped left-right and its camera
    reflected across the head's sagittal plane. Photos are the same mechanism with three fixed cameras (front, side,
    back, the user saying which is which), flipped for the missing side.
  - **Fit, always by hand as well** (the user's note): the automatic alignment is only a starting point. The
    reference has handles the user drags on the overlay itself and matching sliders: **scale** and **position** of
    the picture (the same for every frame, so one fit holds round the turn), and **the orbit's lock to the view**:
    which frame is the front (a turn offset), the direction of the turn (clockwise or not), how many degrees the
    video covers (the sweep) and the camera's height (above, level, below). Dragging the view turns the head; the
    "turn offset" slider turns the video under it until the two face the same way, and from then on they stay locked.
    "Glue again" goes back to the automatic fit. The fit is saved in `salon.json` with the reference.
  - **No green screen needed.** The overlay is drawn half-transparent, so the frame's background simply shows through
    faintly; the key is an option (it cleans the overlay up when the backdrop is green), not a requirement. Without a
    face and without a key the orbit prior and the hand fit alone place the frames.
  - The visual hull (`gshair.py hull`, the keyed frames' hull from the orbit poses as a translucent mesh) stays an
    optional layer for later; the locked frames are the reference the user draws against.
  **Done 2026-10-22** (docs/SALON.md): `gshair.py reference` and `run --to reference`, the head-local space from four MHR vertices (a symmetric pair: docs/LESSONS.md), the automatic fit from the face (the MiniMax wig: 24 landmarks, 5 mm), snapping, the fit's sliders and the Fit tool, "use up to" with the mirrored far side, photos as three fixed cameras. Not yet: a photo's own nudge in the page (the data has `fit.per_frame`), the hull as a layer.
- [x] **The reference's cube** (the user's ask, 2026-10-22): the reference inside a 3 x 3 x 3 lattice, the whole cube
  stretched and each face's 3 x 3 points pulled to bend the views it faces, corners and edges shared between faces;
  symmetric pulls; undo. **Done 2026-10-22** (docs/SALON.md, The cube).
- [x] Load and save `salon.json`; the presets list; `node tools/character/salontest.js`: loads, draws the head, the
  guide fits, a save round trip. `SALON ok`.
  **Done 2026-10-22**: `salon.json` through `api/hair/<name>/salon.json`, the list from `api/salon`, `?hair=NAME`; SALON ok.

## Phase 2: the vector lock tools (the heart)

- [x] **Picking on the head**: click → the point on the body surface under the cursor (raycast the body mesh), its
  triangle and barycentric weights, its normal. Roots snap to the scalp (reject outside the scalp unless Shift).
  **Done 2026-10-22**: the scalp tinted while a tool is armed; Shift lets a root off it.
- [x] **Strand tool**: click the root, click the end; a Catmull-Rom curve with 6 control points spread between them,
  bulged along the root's normal; the points shown as handles after placing; drag a handle to shape (in the view
  plane; Alt-drag along the view axis); the curve stays off the body (push-out on every edit). Scroll wheel before
  the end click: the curve's sag (how far it bows out).
  **Done 2026-10-22**, and an end clicked on the body lies on it (a fringe on the brows), in the air on the plane through the root.
- [x] **Sheet tool** (the realism root): drag a **root line** along the scalp (points sampled every 1 cm on the
  surface), then click the end line's two corners (or one click plus the wheel for the spread: the end line's width,
  centred on the click); the sheet is the ruled surface between root and end, with 4 to 8 guide curves across it,
  each a Catmull-Rom like a strand; the **outline points** (root line, end line, the two sides' middles) are the
  handles; the whole sheet is one group.
  **Done 2026-10-22**: the root line dragged (a point every 8 mm on the skin), one click plus the wheel's spread for the end; the edges (left, middle, right) are the handles. The end's two corners as two clicks: not yet.
- [x] **Bundle tool**: a root line (or a root circle of a radius from the wheel), a tip point; a tapered tube of
  guides; a `spread` at the root and at the tip (the triangle: wide to gathered, or gathered to wide); its middle
  ring's points are handles.
  **Done 2026-10-22**: a root (its width from the wheel) and a tip; the radius at the root and the tip as sliders; the spine's points are the handles. A root line for a bundle: not yet.
- [ ] **Trace the outline** (the layman's main act): in the front, side or back view, with the reference laid over
  the head, a lasso draws the hair's outline; the locks visible in that view are scaled and moved (about their roots,
  by a 2D warp of the view plane, the depth kept) so the hair's projected outer boundary matches the trace; three
  traces and the rough shape is done. The trace is kept in `salon.json` so it can be redrawn.
- [ ] **Galleries with pictures** (one click swaps those locks, the rest kept): the fringe (blunt hime, see-through,
  curtain, side-swept, wispy, none), the sidelocks (hime chin-length, face-framing, none), the parting (middle, side,
  none), tails (twin, pony, half-up, buns), the length (shoulder, chest, waist), the volume (flat, airy, big), the
  colour (black, dark brown, ash, chestnut, a lighter tip) and the shine (realistic highlights or an anime band).
  Each entry is a small set of locks or a change to the current ones, built from the Asian cuts of `hair.js`.
- [ ] **Mirror** (a toggle, with a seam): with Mirror on, every lock placed, moved, shaped or deleted on one side of
  the seam does the same on the other; the twin is a link in `salon.json` (`mirror_of`), kept until "Break the
  mirror" on a lock or the group. The seam is a plane: **the middle** (the head's sagittal plane from the landmarks)
  by default; **moved** sideways with a slider when the parting isn't central (a plane parallel to the middle, the
  user's "own seam"); or **drawn**: two clicks on the scalp set a line and the plane through it and the head's
  centre, for a parting that isn't straight across. The seam is drawn on the head as a thin line while Mirror is on.
  Mirrored roots are snapped back to the scalp (reflected across a plane, a root lands within millimetres of the
  near-symmetric head: pushed to the surface along the normal), guide points reflected, the lock's handedness
  flipped (a curl's turn too). Tracing with Mirror on traces both sides at once from one half.
  **Built 2026-10-22**: the toggle, twins (`mirror_of`) that follow every edit (dragging a twin edits its original), roots snapped onto the skin, the seam in the middle or moved sideways (a slider), Break the mirror; not yet: the drawn seam and drawing it on the head, tracing with Mirror on.
- [ ] **Groups panel**: every lock a row (name, type, visible, colour, physics on, realism); select, hide/show,
  duplicate, mirror once (a twin across the seam without the link), delete, reorder; undo/redo (a stack of
  `salon.json` states, cheap).
  **Built 2026-10-22**: groups (new, the active one, show and hide), every lock a row (select, show, hide), name, colour, drawn as, duplicate, mirror once, break the mirror, delete, undo and redo; not yet: reorder, physics on.
- [ ] **Shaping on a selected lock**: four brushes as modifiers of the handles, never per strand: comb (drag the
  tips sideways), grow/shrink (length), puff (away from the head), smooth; and sliders: curl (a spiral of a radius
  and turns along the lock), frizz (noise), clump (the guides pulled to the lock's centre line), width, taper. The
  sliders re-evaluate from the handles and are never baked into them until the user clicks "Apply". After every
  brush: the length pass and the push-out (Blender's constraint step, ported).
- [ ] **Drawing**: a lock is drawn as ribbons (reuse `ribbon` + the strand alpha texture) between its guides, with
  the hair shader's two highlights; `realism` > 0 adds interpolated strands inside the lock (reuse `strands.js`:
  the guides are the chains; the strand count from the slider) drawn as GPU lines; `realism` = 1 draws strands
  only. Colour per lock or the head's hair colour; roots darker; occlusion by depth into the hair (the radial outer
  shell from `hair_batch.py`'s idea).
  **Built 2026-10-22**: cards (ribbons with a strand alpha, roots darker) and strands (thin lines spread through the lock, a count); not yet: the hair shader's two highlights, occlusion by depth.
- [x] **The fill** (the user's cheat, 2026-10-22): Trace wraps the locks and the scalp in an orange glow; select its
  points with a brush (mirror), cut, bring back, push out, pull in, smooth, copy a side; Fill makes a mass of hair
  between the head and the glow, combed the way the nearest locks run, with its own cube to bend it. **Done
  2026-10-22** (docs/SALON.md, The fill). It covers much of the fake volume below; the cap's pore texture is still to do.
- [ ] **Fake volume**: the **cap**: select scalp triangles by painting (or "all the scalp", "under the locks"), a
  pore texture (the Studio's procedural skin's pores, darkened, in the hair colour), and a **thickness** slider that
  lifts the cap along the normals and lifts the roots of every lock on it by the same amount, so the hair looks
  fuller with no more hair. A hairline slider (as `hair.js`'s `hairline`).
- [ ] **Brows and lashes**: presets (straight, arched, thick, thin; natural, long, doll) placed from the landmarks
  (`hair.js` already grows brows and lashes: lift those into lock groups the user can edit like any other).
- [x] `salontest.js` grows: a strand, a sheet, a bundle placed by simulated clicks; handles move; hide/show; Mirror on
  with the middle seam and with a moved seam (a lock placed left appears right, moved together, the link broken);
  the locked reference: orbiting 90° picks a side frame and the view camera equals its camera; a partial sweep's
  missing side gets the flipped frame;
  a cap with thickness changes the silhouette; brows and lashes placed; undo. `SALON ok`.
  **Done 2026-10-22** (SALON ok), with the locked reference's snapping, the mirrored far side and the fit too; hide/show not tested yet.

## Game-grade physics: what is kept and what is dropped (the user's call, 2026-10-22)

The hair is for a game: a few locks jiggle with the head's motion, wind nudges them, nothing ever clips. No more.

**Kept:** one or two guide chains per lock (3 to 5 points), verlet as `wig.js` does it now (root pinned to the body,
gravity, a hold toward the drawn shape, damping, 4 constraint passes a frame), ribbons and strands riding the guides
on the GPU; jiggle **opt-in per lock** with one slider (stiff, soft, floppy presets), everything else rigid with the
head; wind as a rustle, not a direction: a small random sway with no bias, a strength and a tempo, on the free points of
jiggling locks with a per-lock weight (the hair bounces a little either way, like a bush, and you can't tell where it
blows from);
a push-out against the proxies every frame then the length pass, and a one-off settle of the rest shape when the body
or the clothes change. Budget: 40 locks, about 300 simulated points, one push-out per point per frame: nothing.

**Dropped:** bending springs and parallel-transported targets (the hold keeps the drawn bend), the fake root (a pinned
root and the hold leave the scalp the drawn way), the hair-volume grid, drag beyond damping, substeps, the implicit
solver, Blender's slide-on-the-plane collision (push-out and the length pass are enough at this scale), a mesh BVH
(proxies only: the head's radial field, the body's slices, a coarse voxel occupancy for a garment). The brushes are
four: comb, grow/shrink, puff, smooth (snake hook is comb at the tip, pinch is the clump slider, slide is dragging
the root handle, delete and density are the groups panel). Realism strands stay optional; they cost nothing at
runtime since they ride the guides.

## Phase 3: physics, the clothed body, the bake

- [ ] **Physics per lock** (`physics.on`, off by default): the lock's one or two guides become wig.js chains of 3 to
  5 points (pinned at the root, the sheet's root line pinned along it), gravity, hold to the drawn shape, damping, from
  one `jiggle` slider (stiff, soft, floppy presets), and the push-out against the head field, the body slices and the
  garment proxy, then the length pass. No bending springs, no fake root, no substeps. Wind: a rustle, not a
  direction: each jiggling lock's free points get a small random sway (smooth noise per lock and per point, zero on
  average, no side it comes from) with a strength and a tempo, and a per-lock weight. The head motion test (turn, nod, shake, walk) as in the
  Studio. Locks without physics are rigid with the head. The strands and ribbons follow the guides (already how
  `strands.js` works).
- [ ] **Never clip**: on every edit and every frame, every guide point pushed out of the proxies by a gap (2 mm, a
  slider); when a garment is loaded, the rest shape is re-relaxed off it once ("Settle on the clothes") so the hair
  sits on the collar rather than the shoulders; the same hair reloads on a clothed or unclothed body and settles
  either way. Measure it: `inside_pct` as `wig.measure` does, shown in the stats line, checked in the test.
- [ ] **The bake** for the Studio's runtime (`bake.json` beside `salon.json`): per lock: the guide chains (rest and
  pinned points), the physics settings, the ribbons' geometry and the strands' offsets (the `batch.bin` idea), the
  cap mesh; the runtime (Play mode later) loads it and runs only the chains. Keep `animation: {clips: {}}` and a pose
  override per lock for the animation refiner.
- [ ] Export: the locks as OBJ ribbons with UVs (as `hair.js` exports) and the chains as JSON (bones), for anything
  outside the Studio.

## Phase 4: the easy UI (the player's path above, made real)

- [ ] The panel in the path's order: Cut, Reference, Trace, Fringe & Sides, Shape, Colour, Move, Save; one sentence
  of help at the top of each, a Next button, any step skippable; the wall of cuts first, never a blank head.
- [ ] The head idles (a slow turn and a breath) while nothing is dragged; Shake; "How it looks in the game"; Photo
  mode (the head beside the reference); "Surprise me".
- [ ] One tool bar for the expert's tools: Strand, Sheet, Bundle, Cap, Brow, Lash, Select; one-key shortcuts; the
  wheel's meaning shown while a tool is armed ("wheel: spread 6 cm"); Esc cancels; Enter finishes a line. Words in
  the UI: lock, fringe, sidelocks, tail; never curve, guide, lattice, node.
- [ ] A style bar per lock with word sliders (short to long, straight to wavy, thin to thick, neat to messy, the
  clump) with a preset dot on each, and three presets (anime, stylised, realistic) that set them together; the
  numbers behind them never shown.
- [ ] Hair presets: whole heads of locks saved and reloaded onto any body (roots are scalp-relative so they land on a
  different head); the Asian cuts of `hair.js` rebuilt as salon presets (hime, see-through bangs, curtain, layered
  bob, wolf, two-block, half-up, low pony) so a game's cast starts from them.
- [ ] The locked reference, the hull and the splat as **toggleable layers** with opacity; the Reference step asks
  only three things: drop the file, how far the video turns (a full turn / to the side / to the back), and which
  frame is the front when there is no face to find it.
- [x] docs/SALON.md: the tools, the shortcuts, the data, the checks; the launcher's lines; CLAUDE.md's table row.
  **Done 2026-10-22**: docs/SALON.md, the launcher's two lines, CLAUDE.md's row and the SALON check.

## Phase 5: later, designed for now

- [ ] The animation refiner: play a clip on the character, adjust a lock's physics per clip, lock a pose at a frame
  (`animation.clips[clip].locks[id] = {physics, keys: [{frame, points}]}`), scrub.
- [ ] A hand (the player's) and a passing body as pushes on the chains (the rustle is already Phase 3).
- [ ] A groom export for Unreal (Alembic through Blender's module, `tools/retarget.py`'s route) if the humans ever
  go back there.

## Rules for the build

- Never per-strand editing: the smallest thing the user touches is a lock's handle or slider.
- Every tool works with click, click, wheel, drag; no modal dialogs; undo everywhere.
- Measure, don't eyeball: inside percentage, drift, frame times in the stats line; the tests check them.
- Blender's functions are ported freely (the user's call), with Blender's names kept and a GPL-2.0-or-later header on the files that carry them; THIRD_PARTY.md says so.
- The Gaussian tools stay in the repo as the reference layer (and the record of what was tried); nothing of them is
  needed to draw hair.
