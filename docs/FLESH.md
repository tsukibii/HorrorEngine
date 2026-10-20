# The fat suit and the water balloons: jiggle and sag from soft tissue (experiments)

**The page's default is now the soft bones (§5):** the look the user asked for (a balloon that moves as one object
and touches things), not a tissue simulation. §2 to §4 are the first experiment, the per-point springs (the
`per-point springs` solver on the page), kept for comparison.

The user's idea (2026-10-20): treat a character as a lean person wearing a fat suit, and work out the jiggle, sag,
droop and support from that. The desk's **Fat suit** page (`tools/director/flesh.html`, code in `flesh.js`) runs it.

## 1. The two bodies

MHR's identity shapes all share one mesh, so any two bodies match vertex for vertex.
- **The suit** is the character (its `shape`).
- **The lean body** is the same character solved for the least fat: the body sliders fitted (least squares) to keep
  height, arm span, crotch height and shoulder width, while waist, belly, hips, backside, chest depth, thighs and upper
  arms come down to 70 % of the average body's. Head and hands stay the character's.
- **Thickness** = how far the suit stands off the lean body along the skin's normal, per vertex (never negative;
  where the lean shape would stand outside the suit, at collarbones and shoulders, it's zero). Heavy test body: belly
  10.6 cm, backside 8.5, chest 6.0, thighs 5.4, upper arms 2.5, face 0.

## 2. The physics, from thickness alone

Each point of the suit is a damped spring around where the skinned suit puts it (so animation still leads), with:

| Quantity | Formula | Means |
| --- | --- | --- |
| mass | density x thickness x skin area | more fat, more mass |
| stiffness | shear modulus x area / thickness | a thick layer shears easily (soft); skin on bone is stuck |
| ringing | f = sqrt(G / density) / (2 pi thickness) | thin fat buzzes and dies at once; a belly wobbles slowly |
| sag | density x g x thickness^2 / G | twice the fat, four times the droop |

With fat at 900 kg/m3 and G = 2000 Pa (the default): a 10 cm belly rings at about 2.4 Hz, 4 cm at about 6 Hz.

The rest of the model:
- **Gravity** counts only what changed since the standing pose the shape was made in. MHR bodies already hang under
  gravity, so standing adds nothing; lying down, the change is a 90° turn of gravity, and fat slides sideways.
- **Support** comes from the lean body inside. Fat compresses at most 60 % of its thickness toward the muscle, and
  stretches at most 80 % from where the suit puts it (the skin holding it).
- **The layer is continuous.** Neighbours pull on each other (a Laplacian of the offsets) and the skin smooths the
  offsets toward their neighbours' (surface tension). So it moves as one sheet, with waves, instead of folding where
  thick fat meets thin.
- **Thin fat** (under about 3 cm) is held to the bone with a soft ramp, so faces, hands and shins don't move.
- **Damping:** 15 % of critical.
- **Integration:** in world space at 4 substeps a frame, so walking, stopping, turning and landing all throw the fat
  by inertia.

## 3. Results (peak and final mean jiggle offset per region, cm; 2026-10-20)

| Body (belly fat) | bounce | jump, landing | walk and dead stop | 125° turn | lying down (sag at rest) |
| --- | --- | --- | --- | --- | --- |
| heavy (10.6 cm) | belly 4.6 | belly 8.8, backside 7.1, chest 5.0 | belly 7.6 | belly 8.6 | belly 6.9, backside 5.3, chest 3.1 |
| average (3.8 cm) | belly 1.4 | belly 3.3, backside 3.0 | belly 2.6 | belly 2.2 | belly 1.0 |
| Mari (1.7 cm) | backside 0.5 | thighs 1.7, backside 1.6 | thighs 1.7 | thighs 0.8 | thighs 0.4 |

- Everything settles within about a second and a half (the final offsets are under 0.2 cm, standing).
- The heavy body's landing reaches the skin limit (80 % of the thickness): the skin is what stops it.
- A lean body barely moves, with no special case for it.

## 4. Water balloons: breasts and buttocks on a flat base (2026-10-20)

The user's follow-up: a woman's body made flat (flat chest, flat backside), with the breasts and buttocks added as
volumes behaving like a large water balloon, for realism. Same page, **water balloons** mode.

**The base and the volumes:**
- **Flat base:** Mari's shape with the chest and backside solved flat (`flatShape`, the lean solve aimed at those
  regions), on the finer MHR mesh (`MHR_hi`) so the domes are round.
- **The volumes** (`balloonSculpt`): an ellipsoid per breast and per buttock, sized in litres (default: bust 0.9 L
  each, buttocks 0.6 L each; the page has sliders), partly sunk into the body and joined to it with a smooth fillet
  (a soft union: the skin inside it moves out along rays from deep in the body, so nothing overlaps and the fold
  under it is soft). The upper half is longer and flatter than the lower; droop lowers it; breasts point a little
  apart, buttocks sit deeper (a flatter swell). Sized from the ellipsoid's cap, then corrected on the measured volume.
  (The first version pushed domes out per point; their lower halves folded over the body and creased.)
- **Thickness** is the dome's height, so the fat suit's physics apply unchanged, with water's numbers.

**What a water balloon adds to the fat suit:**
- **It keeps its volume:** each balloon is corrected to its rest volume every step (a squashed side bulges elsewhere).
- **The midline:** left and right can't cross a plane through the sternum (from the chest bone and clavicles) or the
  cleft (from the root and thighs).
- **The bulk swing:** one damped mass per balloon moves the whole dome, weighted by height (the tip swings, the rim
  stays). Per-point springs alone hold the tip in place, which no balloon does.
- **Damping on the motion relative to the body**, not in the world. Damping world velocity drags the tissue behind at
  any constant speed; this was a bug in the fat suit too, fixed for both.
- **Support (a bra):** a stiffness multiplier on the breasts: none 1, everyday 2.5, sports 7.
- **Settings** (`BALLOON_PHYS`): density 1000 kg/m3 (water), shear 250 Pa, damping 20 % of critical, skin smoothing
  almost off (it acted as hidden stiffness).

**The motion:** walk (a 4.5 cm raised-cosine bob, sway, hip turn) and run (2.8 steps a second, flight for 60 % of the
step, 4 cm of compression at landing, more sway and turn), plus the fat suit's bounce, jump, stop, turn and lying.

**Results against the research** (resultant range of the breast's apex relative to the trunk, cm):

| Case | walk | run | the research |
| --- | --- | --- | --- |
| D cup (0.55 L), no bra | 2.1 | 8.0 | Scurr et al. 2011: 4.2 walking, 15.2 running at 2.8 m/s |
| same, everyday bra | | 4.3 (-46 %) | everyday bras cut it by about a third to a half |
| same, sports bra | | 2.2 (-73 %) | sports bras: -60 to -70 % |
| large (0.9 L), no bra | 4.5 | 6.7 (mostly side to side) | |
| large, sports bra | | 4.1 | |
| buttocks (0.6 L) | | 8.2 | |

- **The shape of it is right:** running moves the tissue about four times as much as walking, a bra's effect is
  where the studies put it, and a heavier volume swings slower (the large bust rings below the step rate, so it moves
  side to side more than up and down, as observed in larger cups).
- **The size is about half the literature's.** One spring can't match both: softer, and the walk overshoots and keeps
  ringing; stiffer, and the run is too small. Real tissue is nonlinear (soft near rest, stiff as the skin and
  ligaments tighten) with a peak response near 4 Hz and damping around 0.2 (finite element studies); a stiffening
  spring (stiffness rising with stretch) is the next thing to try, then the measured trajectories as targets.
- **Nothing here is explicit:** a featureless mannequin, technical cameras (cutaway, heat map, ghost), measured as
  numbers.

Sources: Scurr, White, Hedger 2011 (breast displacement in three dimensions, walking and running); the bra-support studies
(everyday and sports bras); a finite element study of breast motion during running (damping 0.215, response peak
about 4 Hz).

## 5. Soft bones: the default (after EZSoftBone)

The user's verdict on §4: real breasts move like a water balloon, as one object, and the per-point springs contorted
into shapes flesh doesn't make; it only has to look right, not be a tissue simulation. And it should react to objects
in the world. They pointed at **EZSoftBone** (a Unity plugin, MIT, github.com/EZhex1991/EZSoftBone), the same family
as Unity's Dynamic Bone and Unreal's **Kawaii Physics**. `softbone.js` (`SoftBoneSim`) does the same thing on our bodies.

**How it works:**
- **A chain per soft region.** Breasts and buttocks (balloons); belly, chest, buttocks, love handles, thighs and
  upper arms (fat suits, wherever there's more than 6 mm of fat). The chain runs from the region's floor (the lean
  body under its deepest point) out through its tip, with two joints (at 45 % and 80 % of the depth).
- **EZSoftBone's solver, per 60 Hz tick:**
  - gravity felt, less its *resistance*;
  - *damping* of the joint's motion;
  - *stiffness*: a pull back toward where the animation puts it;
  - *slackness*: how loosely it keeps its length.
- **Our changes to it:**
  - damping acts on the motion relative to the body, so a runner doesn't drag the flesh behind (the same fix as in
    §4);
  - gravity counts only what changed since the standing pose;
  - a **limit angle** (40°, as in Kawaii Physics) and squash/stretch limits, so a shove can't fold it back through
    the body.
- **The mesh follows as one piece:** a single transform per region, from its floor to its tip. It swings and
  squashes or stretches along the chain, keeping its volume: squashed, it bulges; stretched, it thins. The middle
  joint shapes the motion (the lag, the overshoot), not the mesh, because blending two bones' transforms tore the
  shape.
- **The spread** (the user's note: soft tissue bends and shapes as a whole object):
  - Each region's weights are measured as distance over the skin from its deepest point. The mound moves fully out
    to 55 % of its reach, then the pull fades over the skin around it, to 1.6 times its reach at the reference depth
    (6 cm), more for deeper fat.
  - The body around and under it takes a share that grows with the fat's depth: 30 % at 6 cm, up to 85 %.
  - Breasts, buttocks and chest spread 1.4 times further and take 1.4 times the share.
  - The lean body under the suit (seen in the cutaway or ghost) moves with 80 % of that share.
  - The page's **colour: spread** shows the weights.
- **Collisions:** the joints have radii (the tip a quarter of the depth, the middle 40 %) and are pushed out of the
  world's colliders:
  - floor, walls (planes), boxes (a counter), balls (spheres);
  - the arms (capsules sized from the skin), for breasts, chest and belly;
  - each other, left and right.
  Then the skin of the soft regions is pushed out of the same shapes, so a contact flattens it (measured: the skin
  stays within 3 mm of the wall, the counter, the floor and the ball).
- **The presets** (`SOFT_MATERIALS`, root then tip; sliders on the page):

  | Preset | damping | stiffness | resistance | slackness | squash |
  | --- | --- | --- | --- | --- | --- |
  | balloon | 0.10, 0.12 | 0.12, 0.08 | 0.6, 0.4 | 0.30, 0.40 | 1 |
  | fat | 0.12, 0.15 | 0.24, 0.16 | 0.7, 0.55 | 0.15, 0.25 | 0.8 |

  A bra (`supported`): firmer by its factor (stiffness compounded, damping x sqrt, slackness divided).
  On a limb (thighs, upper arms) the **limb** preset: damping 0.18, 0.2; stiffness 0.45, 0.35; a 20° limit angle.
  The flesh rides with a fast-swinging bone, and the fat preset lagged into a lump on the outer hip when running.
- **The jiggle slider** (the page's header, live): 1 is the presets (medium), 0 firm, 2 very loose (`jiggled`).
  Looser means stiffness x 2^(-1.2 (j - 1)), damping x 2^(-0.8 (j - 1)) and slackness x 2^(0.5 (j - 1)), capped.
  On the hourglass's chest, running: firm 6.0 cm, medium 9.9, very loose 13.1; walking 0.6, 2.6, 7.9.
- **New scenarios:**
  - **wall:** walks into it and leans 3.5 cm;
  - **counter:** chest or belly high;
  - **ball:** a 22 cm ball tossed at 2.5 m/s that sinks in 6 cm;
  - **prone:** face down on the floor;
  - **arms:** crosses the arms;
  - **lie:** on the back, now on the floor.
- **Cost:** about 2 to 8 ms a frame in headless Chromium (software GL) on the 10k-point mesh. The chains are a few
  points; the skinning of the regions is the cost.

**Results** (the breast's tip, resultant range relative to the trunk, cm; Mari's flat base):

| Case | walk | run | the research (§4) |
| --- | --- | --- | --- |
| D cup (0.55 L), no bra | 6.5 | 14.7 | 4.2 walking, 15.2 running |
| everyday bra | 2.0 | 10.1 (-31 %) | about a third to a half less |
| sports bra | 0.4 | 6.7 (-54 %) | -60 to -70 % |
| large (0.9 L), no bra | 6.7 | 16.4 | |
| buttocks (0.6 L) | 6.2 | 11.6 | |
| heavy fat suit, belly (16 cm deep) | 3.6 | 17.4 | |

The run matches; the walk is a little lively, which reads fine; the sliders tune both.

**The chubby hourglass** (body **chubby hourglass (Mari)**, fat-suit mode): MHR's sliders alone can't make one.
- Its body space comes from scans and widens the waist with the hips: 0.78 waist to hips at the sliders' limits,
  against Mari's 0.80.
- So it's built in two layers:
  1. `hourglassShape` fits the body sliders from Mari's shape: hips x1.25 of the average woman's, thighs x1.18, upper
     arms x1.12, a soft belly x1.06; chest and backside fitted flat, as for the balloons' base; her waist held.
     The result: 0.70 waist to hips.
  2. `HOURGLASS_SCULPT` adds a 0.6 L bust and 0.55 L buttocks (each side) and a 0.35 L low belly (a flat swell), and
     cinches the natural waist by 9 %.
- It runs as a fat suit over its own lean body, so every region gets a chain: belly, chest, buttocks, thighs and
  upper arms.
- **Export OBJ** on the page writes the sculpted body (T bind pose, cm, closed) for MetaHuman's body conform, as the
  Shape page does for slider-only bodies.

**The refiner** (the side panel, soft bones): a 3D brush like the creator's paint tool (`creator/src/js/80-paint.js`
in Woohill).
- **What it paints:** strokes are measured on the body in its bind pose, in cm (size, softness, strength); mirror
  (x to -x) is on by default; "through" paints the far side too.
- **The tools:**
  - **add / remove volume:** fat thickness along the skin, 0.6 cm a dab x strength. It can go past the lean body.
  - **more / less jiggle:** a multiplier on how much each point follows its soft bone (1 = as built; 0 = it stays
    with the body).
  - **smooth** and **reset.**
- **How it shows:** a transparent overlay (red added, blue removed; orange more jiggle, teal less).
- **Controls:** left drag paints, right drag turns the view, Shift inverts, Ctrl+Z undoes a stroke.
- **When the physics updates:** a volume stroke rebuilds the soft bones when it ends (new thickness, new regions and
  chains).
- **Where it's kept:** in the browser, per body and mesh. The Export (soft bones) carries the painted jiggle in its
  weights; Export OBJ carries the painted volume.

**The Lines tool** (the refiner's `lines` button, `lines.js`): the fat suit's silhouette as vertical lines, the way a
modeller works a figure (the user's reference, 2026-10-20).
- **The lines:** over each soft part (breasts or chest, belly, love handles, buttocks, thighs, upper arms; the
  volumes in balloon mode), a few lines spread round it, each the cut of a vertical plane through the part's centre
  line with the part's triangles: a clean curve that stops where the fat attaches to the body (the part's edge: fat
  under 6 mm, or a volume's rim). Red lines are a part's outer ones, green the inner.
- **The points:** five per line to start, as positions along it. Drag one in or out along the skin: the skin round it
  follows with a smooth falloff (Blender's proportional editing); **scroll** sets the grab radius (the ring).
  **Cut** adds a point where a line is clicked; **Shift-click** removes one. Mirror and undo are the refiner's.
- **Only the fat suit moves:** the lean body is a hard floor (`FleshSim.volMin`, also on the brush now): nothing goes
  inside the skinniest version. A pull is the refiner's volume map, so it rebuilds the soft bones on release, shows in
  the overlay, exports with the OBJ and the soft bones, and is kept per body and mesh in the browser; the points
  added with cut are kept too.
- **Retrace** draws the lines again from the body as it is (points reset).

**Jiggle by area:** bust, butt, thighs, belly, arms. Each multiplies how far its region's swing shows (the tip's
offset from where the animation puts it, before the mesh follows). It isn't capped, for testing: in a run with bust
6, butt -2 and belly 25, the belly swung 78 cm and nothing broke. The values are kept in the browser.

**More vertices** (the page's mesh select; MHR's levels of detail, all from its release):

| Mesh | Vertices | Build | A frame (software GL, here) |
| --- | --- | --- | --- |
| LOD 4 (`MHR.fbx`, the desk's) | 2,461 | | |
| LOD 2 (`MHR_hi.fbx`, auto for balloons and the hourglass) | 10,661 | 5 s | 8 ms |
| LOD 1 (`MHR_lod1.fbx`) | 18,437 | 8 s | 18 ms |
| LOD 0 (`MHR_lod0.fbx`) | 73,639 | 39 s (30 s of it reading the FBX) | 57 ms |

- **The look:** LOD 0 takes away the angular look: volumes come out round and smooth, like water balloons. At LOD 2
  the edges are about 1.5 cm long and show as facets close up.
- **For comparison:** a MetaHuman at LOD 0 is about 30,500 body vertices plus 24,000 for the head (Epic's LOD
  specifications).
- **Where the cost is:** our CPU skinning in the browser. In Unreal the mesh is skinned on the GPU and the soft bones
  are a few bones, so the vertex count costs little there.
- **Cheaper next step:** keep the physics on LOD 2 and draw a subdivided surface (Loop subdivision, from the same
  points each frame).

**Breast shape beyond a round volume: tried and shelved (2026-10-20).** The references (a teardrop: a long upper
slope from high on the chest, the fullness low and to the outside, a round underside into the crease) were tried three
ways: a teardrop height field with a downward shear, a mass point the skin is pulled toward, and the user's analogy, a
firm ball sunk in the chest with fat pooling around and below it (the skin projected onto the two). Each came out
flat, creased or faceted for the same reason: at LOD 2 the edges across a breast are about 1.5 cm, so a crease and
an underside have only one or two triangles to be drawn with, and the finer MHR meshes are too slow in the browser.
Decision: the round volumes stay for the desk; the shape itself is MetaHuman's job (its own body mesh and the
conform), the jiggle Kawaii's. The ball-in-fat analogy is still the right setup there: two bones per breast, a stiff
one for the ball (little swing) and a loose child for the fat around it (the swing), the skin weighted by how much fat
is over the ball. The page keeps the **wireframe** toggle to see the stretch.

**For Unreal:** the page's **Export** writes `Content/Games/<Game>/Characters/<body>_softbones.json`, with:
- the bones to add (`soft_<region>_root` under the body bone it hangs from, then `_1`, `_2`), bind positions in
  MHR's bind space;
- the skin weights per point (the spread, on the root bone);
- the preset.

Kawaii Physics takes the same numbers (Damping, Stiffness, per 60 Hz tick, a radius, a limit angle, and sphere,
capsule, box and plane limits), so a chain set up from the export moves the same way. Kawaii keeps bone lengths, so
the squash would be a small step after it in the Anim Blueprint: scale the root bone by the chain's length ratio
along it and 1/sqrt of it across. MetaHuman bodies have no soft bones: add them (Skeleton Editing in the Skeletal
Mesh Editor, or Blender) and transfer the weights by closest point, as for the thickness map.

## 6. Where it goes next

- **In the desk:** the same simulation could run under BodyFigure for every MHR cast member (about 2,500 points, a
  few milliseconds a frame), so the storyboard and Watch show it. It's not switched on yet; the experiment page
  comes first.
- **In Unreal (per-point springs):** Export writes the thickness map (per point: bind position and fat in cm) and the settings
  to `Content/Games/<Game>/Characters/<body>_fat.json`.
  - Transfer it by closest point onto the MetaHuman body, which was conformed to the same MHR body.
  - Then either run the same spring per vertex in a Deformer Graph (the equations above, on the GPU), or set jiggle
    bones (Kawaii Physics or AnimDynamics) per region from the table: stiffness from the ringing frequency, limits
    from the sag.
  - Physics runs on top of any animation, so Kimodo and mocap motions get it as they are.
- **Still to try:**
  - the finer mesh (MHR LOD 2, 10k points);
  - contact support from outside (sitting: the thighs and a chair carry the belly);
  - per-region tuning (breasts and belly differ in stiffness);
  - tying the anti-clip squash (ANIMATION.md §0b) to the same thickness.
