# Curtains that hang like curtains (for the prop generator)

2026-11-04. The user: "a curtain generator prop that uses a bit of drape physics to get more natural curtains ... fields
for how many sides (1 curtain or 2 on each side), you add the height and length of the window and it generates
curtains to use. Research first for the easiest technique." The kit's curtain (`kit.js` `curtainGen`) is a zigzag of
flat boxes, the same from the rail to the hem; this note is what makes a real one read, the ways to make one, and the
way chosen.

## What makes a curtain read as real

1. **The heading sets the folds.** A curtain is wider than its rail by its **fullness** (fabric width over rail width),
   and the heading decides how that fabric is taken in at the top. Wave (Ripplefold): carriers in a track every 54 to
   67 mm, the snap tape on the fabric at twice that for 2x (Kirsch: 2.5x at 1 7/8 in, 2x at 2 1/8 in, 1.8x at
   2 3/8 in, 1.6x at 2 5/8 in), the fabric between carriers bulging front and back in turn, a ripple about 100 to
   150 mm deep; 2x is the usual. Pinch pleat: two folds at 2x, three at 2.5x (most hang 2.5x), a pleat every 100 to
   125 mm, pinched about 100 mm down, the flat space between pleats bellying out. Grommets: the rod through eyelets
   every 150 to 200 mm, the cloth folding front and back between them (1.5 to 2x; no maker's numbers found). Gathered
   on a rod (rod pocket, pencil pleat): small irregular gathers, 2 to 3x.
2. **Below the heading the folds relax**: they keep their count (a trained curtain holds its folds) but grow softer and
   a little wider toward the hem, which is heavier (a weighted hem hangs straight); every fold its own depth.
3. **Stack-back**: drawn open, a curtain packs to the side into 10 to 12 % of its track (a wave's) to about a quarter
   (pinch pleats), its folds deeper and tighter.
4. **Tie-backs** gather a panel to the side at a height: the cloth swoops from the rail into the band and flares below.
5. **Length**: to the sill, below it (about 150 mm), just off the floor, or breaking and pooling on it.

## Three ways to make one

- **Simulate it from flat** (Blender's cloth with a pin group, Marvelous Designer's pins and tacks, Houdini's Vellum):
  the most physical, but the gathering buckles chaotically unless the pins are moved in slowly over many substeps, and
  a hanging cloth stretches under its own weight in a position-based solver unless it iterates a lot.
- **Shape it by numbers** (POV-Ray's sine folds faded toward one end, the geometry-node generators such as 3D Tudor's
  curtain node and Curtain Maker Pro: fold count, depth, header, hem, noise): fast and controllable, stiff-looking
  where gravity should have acted (the kit's curtain is this).
- **Shape it, then let it settle** (chosen: the easiest that looks real). Build the hung shape from the heading's own
  geometry (the folds per heading and fullness, each row as long across as the cloth is wide, so nothing is stretched
  at the start), pin the heading, and run a short settle of the prop generator's cloth (`sim.Cloth`, position-based):
  gravity, the bend (its rest the shaped folds at the heading, flatter toward the hem), **long-range tethers** (each
  point kept within its rest distance of the rail: Kim, Chentanez and Müller's long range attachments, the tethers
  of PhysX and Unreal's Chaos Cloth; unilateral, so they stop the stretch and never the folds), a **tie-back as a ring** drawn in over the first steps, the wall and the
  floor (a pooling hem) as colliders. The heading's shape does what the solver is worst at (organised folds); the
  solver does what the numbers are worst at (the swoop into a tie-back, the hem on the floor, gravity's sag, no two
  folds alike). The fine wrinkles, the hems and the weave go into the detail mesh and are baked, as the bedding's
  (PROPGEN §21).

## Sources

- Kirsch's Ripplefold fabrication guide (carrier spacing against fullness, the stack):
  https://cdn.shopify.com/s/files/1/0711/8609/files/KIRSCH_Ripplefold-Fab-Guide_v8.18.pdf
- Wave curtains' spacing and depth: https://twopagescurtains.com/products/ripple-fold-linen-drapery,
  https://twopagescurtains.com/products/andy-cotton-drapery-ripple-fold; fullness and stack-back:
  https://www.draperyrodsdirect.com/ripplefold-drapery, https://easeeasecurtains.com/zh-euro/collections/ripple-fold-drapes?page=1
- Pinch pleats' fullness and spacing: https://www.curtarra.com/header-style,
  https://www.direct-fabrics.co.uk/understanding-curtain-fullness,
  https://easeeasecurtains.com/blogs/news/how-to-choose-hanging-header-style
- Folds by a sine faded toward one end (POV-Ray):
  https://news.povray.org/povray.advanced-users/thread/%3Cslrn8emse5.bfg.ron.parker%40not.a.valid.hostname%3E
- Generators: https://cubebrush.co/3d_tudor/products/k8ia/3dt-curtain-generator-blender-geometry-node-procedural,
  https://shift4cube.gumroad.com/l/CurtainMakerPro; pinning in Blender's cloth:
  https://www.blendernation.com/2022/06/10/blender-3-1-pin-cloth-simulation-tutorial/; pulling cloth shut by rings
  driven from pins (Clothify): https://superhivemarket.com/products/clothify/docs
- Long range attachments (tethers: unilateral, so they never stop the folds forming): Kim, Chentanez and Müller,
  SCA 2012, https://matthias-research.github.io/pages/publications/sca2012cloth.pdf; Unreal's Chaos Cloth calls them
  tethers: https://dev.epicgames.com/documentation/unreal-engine/node-reference/Dataflow/SimulationLongRangeAttachmentConfig
- Position-based cloth, its stretch and bend: https://phys-sim-book.github.io/lec32.1-pbd_cloth_constraints.html,
  Müller et al. 2007: https://alecjacobson.com/seminar/mueller-et-al-2007.pdf; why thin sheets buckle into folds
  (stiff in plane, soft to bend): https://escholarship.org/content/qt6qw6r5gj/qt6qw6r5gj.pdf
