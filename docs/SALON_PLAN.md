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
- [ ] Decide the **lock types** and write their data model in `docs/STORY_FORMAT.md`? No: hair isn't story. Put it in
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
- [ ] Decide the file: `Content/Studio/Hair/<name>/salon.json` (tracked; the user's hair is theirs), beside the
  splat presets. Thumbnails `thumb.png`.

## Phase 1: the salon page, the head, the guide (the shell everything hangs on)

- [ ] `tools/character/salon.html` + `salon.js`: the Studio's look (dark, side panel, orbit by drag, wheel zoom), a
  base body or a character (reuse `buildHead`), the game's lights, a POV button (the player's eye at MCU distance,
  the 90° lens in a 16:9 frame, as the Studio's POV view).
- [ ] The body as **collision proxies**: the head's radial field, the body's slices (port `body_slices` to JS once,
  in `collide.js`), and a garment proxy when a draped garment is loaded (`api/clothes/<name>/<design>`): a voxel
  occupancy of the garment at 1 cm plus its surface normals, `push(p, gap)` → `[q, moved]` like `headPush`.
- [ ] The **reference guide**: `python tools/gshair.py hull --out DIR` (new step: the keyed frames' visual hull from
  the orbit poses as a mesh, marching cubes in numpy or the radial shell of `gshair/wig.py`; no training) → a
  translucent mesh round the head with an opacity slider and a fit (move, turn, scale, the fit sliders from
  `gshair.html`). Also the frames themselves: a filmstrip of the orbit, the nearest frame shown beside the view for
  the current camera angle (the real reference the user draws against).
- [ ] Load and save `salon.json`; the presets list; `node tools/character/salontest.js`: loads, draws the head, the
  guide fits, a save round trip. `SALON ok`.

## Phase 2: the vector lock tools (the heart)

- [ ] **Picking on the head**: click → the point on the body surface under the cursor (raycast the body mesh), its
  triangle and barycentric weights, its normal. Roots snap to the scalp (reject outside the scalp unless Shift).
- [ ] **Strand tool**: click the root, click the end; a Catmull-Rom curve with 6 control points spread between them,
  bulged along the root's normal; the points shown as handles after placing; drag a handle to shape (in the view
  plane; Alt-drag along the view axis); the curve stays off the body (push-out on every edit). Scroll wheel before
  the end click: the curve's sag (how far it bows out).
- [ ] **Sheet tool** (the realism root): drag a **root line** along the scalp (points sampled every 1 cm on the
  surface), then click the end line's two corners (or one click plus the wheel for the spread: the end line's width,
  centred on the click); the sheet is the ruled surface between root and end, with 4 to 8 guide curves across it,
  each a Catmull-Rom like a strand; the **outline points** (root line, end line, the two sides' middles) are the
  handles; the whole sheet is one group.
- [ ] **Bundle tool**: a root line (or a root circle of a radius from the wheel), a tip point; a tapered tube of
  guides; a `spread` at the root and at the tip (the triangle: wide to gathered, or gathered to wide); its middle
  ring's points are handles.
- [ ] **Groups panel**: every lock a row (name, type, visible, colour, physics on, realism); select, hide/show,
  duplicate, mirror left-right (across the head's X), delete, reorder; undo/redo (a stack of `salon.json` states,
  cheap).
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
- [ ] **Fake volume**: the **cap**: select scalp triangles by painting (or "all the scalp", "under the locks"), a
  pore texture (the Studio's procedural skin's pores, darkened, in the hair colour), and a **thickness** slider that
  lifts the cap along the normals and lifts the roots of every lock on it by the same amount, so the hair looks
  fuller with no more hair. A hairline slider (as `hair.js`'s `hairline`).
- [ ] **Brows and lashes**: presets (straight, arched, thick, thin; natural, long, doll) placed from the landmarks
  (`hair.js` already grows brows and lashes: lift those into lock groups the user can edit like any other).
- [ ] `salontest.js` grows: a strand, a sheet, a bundle placed by simulated clicks; handles move; hide/show; a mirror;
  a cap with thickness changes the silhouette; brows and lashes placed; undo. `SALON ok`.

## Game-grade physics: what is kept and what is dropped (the user's call, 2026-10-22)

The hair is for a game: a few locks jiggle with the head's motion, wind nudges them, nothing ever clips. No more.

**Kept:** one or two guide chains per lock (3 to 5 points), verlet as `wig.js` does it now (root pinned to the body,
gravity, a hold toward the drawn shape, damping, 4 constraint passes a frame), ribbons and strands riding the guides
on the GPU; jiggle **opt-in per lock** with one slider (stiff, soft, floppy presets), everything else rigid with the
head; wind as one direction, a strength and a gust noise on the free points of jiggling locks with a per-lock weight;
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
  garment proxy, then the length pass. No bending springs, no fake root, no substeps. Wind: one direction, a strength
  and a gust noise on the free points, a per-lock weight. The head motion test (turn, nod, shake, walk) as in the
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

## Phase 4: the easy UI (what makes it better than Blender)

- [ ] One tool bar: Strand, Sheet, Bundle, Cap, Brow, Lash, Select; one-key shortcuts; the wheel's meaning shown while
  a tool is armed ("wheel: spread 6 cm"); Esc cancels; Enter finishes a line.
- [ ] A style bar per lock with the sliders that matter (width, taper, curl, frizz, clump, realism) and three
  presets (anime, stylised, realistic) that set them together.
- [ ] Hair presets: whole heads of locks saved and reloaded onto any body (roots are scalp-relative so they land on a
  different head); the Asian cuts of `hair.js` rebuilt as salon presets (hime, see-through bangs, curtain, layered
  bob, wolf, two-block, half-up, low pony) so a game's cast starts from them.
- [ ] The reference guide and the splat as **toggleable layers** with opacity; the orbit video's nearest frame beside
  the view; "match the frame": the camera moved to the orbit frame's angle.
- [ ] docs/SALON.md: the tools, the shortcuts, the data, the checks; the launcher's lines; CLAUDE.md's table row.

## Phase 5: later, designed for now

- [ ] The animation refiner: play a clip on the character, adjust a lock's physics per clip, lock a pose at a frame
  (`animation.clips[clip].locks[id] = {physics, keys: [{frame, points}]}`), scrub.
- [ ] Wind and a hand (the player's) as forces on the chains.
- [ ] A groom export for Unreal (Alembic through Blender's module, `tools/retarget.py`'s route) if the humans ever
  go back there.

## Rules for the build

- Never per-strand editing: the smallest thing the user touches is a lock's handle or slider.
- Every tool works with click, click, wheel, drag; no modal dialogs; undo everywhere.
- Measure, don't eyeball: inside percentage, drift, frame times in the stats line; the tests check them.
- Blender's functions are ported freely (the user's call), with Blender's names kept and a GPL-2.0-or-later header on the files that carry them; THIRD_PARTY.md says so.
- The Gaussian tools stay in the repo as the reference layer (and the record of what was tried); nothing of them is
  needed to draw hair.
