# Tables, chairs and their cushions (for the prop generator)

2026-11-04. The user: "a prop gen for tables and chairs; for tables take a length/width/height input; first research
generic table styles (wooden) and shapes, then simple modelling techniques, then micro details (not too many, but
cracks, wood grain, scratches, mostly bumps, as I still want to be able to overlay custom types of wood PBRs). Chairs
currently don't look quite right: some basic chair styles, all able to take simple cushions, the cushions by our
curtain technique: puffy soft physics shaped to the seat, baked; realism with a low poly count (more polys for the
simulation, then bake and simplify before the export)." What was found, and the way chosen for each part.

## 1. Wooden tables: styles and shapes

- **Bases.** The leg table (four legs joined by an **apron**, the band under the top: the classic, from a plain
  Shaker one to turned or carved legs); the **trestle** (two end frames joined by a stretcher: the oldest, a farmhouse
  table's); the **pedestal** (one column in the middle on feet: round and square tops); the **Parsons** (square legs as
  thick as its apron is tall, flush with the top's edge); **mid-century** (tapered legs splayed at an angle, a thin
  apron or none); **farmhouse** (a thick, worn top on turned legs or a trestle). A Japanese **chabudai** is low (15 to
  33 cm), often round, its legs folding under it (round 60 to 90 cm across; 80 cm and 30.5 cm high folds to 8 cm).
- **Sizes.** A dining table stands 720 to 760 mm (29 to 30 in); its top 25 to 40 mm thick (38 mm in a metric drawing);
  it overhangs its legs or apron by 30 to 50 mm (1.5 to 2 in); the apron 70 to 100 mm deep (3.5 to 4 in), leaving
  at least 635 mm (25 in) of knee room under it; legs 40 to 100 mm square (no standard: 4x4s, 4 in tapered ones). A
  coffee table 400 to 450 mm high, a desk 720 to 750, a side table about 550.
- **Top shapes.** Rectangle, square, rounded corners, round, oval, a racetrack (rounded ends).
- **Edges.** Eased (a small round: the default, sharp ones splinter), chamfer and bevel (a wide chamfer; a bevel
  underneath makes a top look thinner), round-over and bullnose (a short overhang's: they soften corners), ogee (two
  arcs, formal); every one a cheap router cut on a real table.

## 2. Simple modelling for a game

- Furniture in games is **mid-poly**: the edges chamfered once (or a chamfer modifier), the normals weighted by face
  size, a bake only where that falls short; or **high to low**: rounded bevels on a detailed copy baked onto a chamfered
  game mesh, keeping the low's silhouette with a few hard edges. Bevels on the high too tight to differ from the low
  bake nothing; curves on the low with too few segments wave in the bake.
- **Wood's UVs follow the grain**: each part unwrapped as the plank it was cut from, its island's length along the
  grain, so a tileable wood texture runs along every part (one set with the grain all one way looks wrong on a frame);
  one texel density for all (a checker shows it); identical parts may share an island (the repeat goes unnoticed when
  they face different ways), mirrored ones too.
- **The way chosen** (the prop generator's own): each part built from numbers (a board: a box with rounded edges; a
  top: an outline extruded, its edge profiled; a turned leg: a lathe), the detailed copy rounded (a few segments a
  bevel), the game mesh chamfered once (one segment), the bevels and the parts' contact shadows baked from the one onto
  the other; every part its own island with its length along the island's x at the material's one density, so a wood
  set laid over the material (the recipe's `pbr`) runs along each leg, rail and board.

## 3. Micro detail as bumps, under a wood set of your own

- The fine fibre goes in the **normal map, at a low intensity** (heavy height detail makes artifacts); the large
  shapes in height, the small in normal. Grain: blurred anisotropic noise with a wobble, directional noise for fibres,
  the rings warped to follow the grain; growth rings as bands of distorted coordinates (their spacing growing from the
  pith), a fine micro-distortion stretched along the wood's axis; early and late wood apart; pores as a separate fine
  mask (Cornell's solid-wood model: rings, fibres, pores, rays). Roughness from the grain (bands in the rings).
- **Flaws**: scratches (Substance's scratches generator), cracks warped along the grain, dents and nicks (a grunge of
  small round ones), saw marks; WoodMachine's "flaws": cracks, saw marks, scratches, vermin.
- **The way chosen**: the flaws as height and roughness only, the colour left to the wood (the paint's own wood_grain
  design, or your PBR set laid over it with its own normal combined with ours): the raised grain and pores at a tenth
  of a millimetre along each island's length, a few checks (thin cracks along the grain, mostly at a board's ends),
  scratches on the top (fine lines every way, shallow, a little glossier or duller), dents (soft round dips, more on the
  edges and the top), and the worn edges and grime the generator's `wear` already makes from the bake's curvature and
  occlusion. Each a knob in the recipe's `flaws`.

## 4. Chairs

- **Styles.** A dining chair (four legs, a seat, two back posts with a top rail and slats); the **ladder-back**
  (horizontal slats between tall posts: the Shaker's, often with a woven seat); the **spindle back** and **Windsor**
  (turned spindles into a solid seat, the legs tenoned into the seat and splayed, the back reclining a little); the
  **bentwood café** chair (a round seat, the back legs and back bent in one loop); a **school** chair (a steel tube
  frame, a plywood seat and back); a **stool**; a **bench**; the Japanese **zaisu** (a legless floor chair).
- **Sizes.** Seat height 430 to 480 mm (450 for a 740 to 760 table, 17 to 19 in), seat depth 380 to 460, width 400 to
  460; the seat tilting back 2 to 5 degrees for dining (8 to 15 for lounging); the back 95 to 105 degrees from the seat
  (100 to 105 upright yet comfortable).

## 5. Cushions shaped to the chair, soft and cheap

- Blender's cloth has had an **air pressure** for closed meshes since 2019 (Sebastian Parborg): pillows and cushions
  are a closed mesh inflated (a cushion: a cube with loop cuts where its seams will be, the top and bottom inflated so
  the cloth has something to grip). For a game: simulate dense, **retopologise** to a light mesh, bake its normal map
  (a commercial set: about 600 to 700 polygons a pillow over a 27 000 polygon source; an old low poly bed's pillow 64
  triangles).
- **The way chosen** (the bedding's bag, PROPGEN §21, made to any outline): the seat's own outline (its trapezoid, its
  rounded corners, notches round the back posts) triangulated finely as two pieces sewn round their border, inflated
  by pressure to a share of what it could hold, settled on the seat by gravity (its bottom flat where it sits), the
  folds at its corners and its seam's puckers drawn into the dense copy; then a **coarse triangulation of the same
  outline takes the dense one's shape by its flat coordinates** (no retopology by hand: every coarse point found in
  the dense flat sheet and moved where that point went) and the dense one is baked onto it: a seat pad of a few hundred
  triangles with the puff, the seam and the folds in its maps. A back cushion the same, settled against the back.
  Ties round the back posts as two small loops.

## Sources

- Table styles: https://vermontwoodsstudios.com/blogs/recent-articles/dining-table-designs,
  https://www.countrysideamishfurniture.com/blog/entry/how-to-choose-a-leg-table-pedestal-table-or-trestle-table,
  https://www.countrysideamishfurniture.com/blog/entry/wood-table-leg-and-base-styles,
  https://designingidea.com/types-of-table-legs, https://onton.com/blog/dining-table-styles
- Sizes: https://www.finewoodworking.com/forum/table-apron-dimensions, https://sawmillcreek.org/threads/table-apron-sizing.267097/,
  https://zumen.scoooop.com/en/blueprint/dining-1, https://www.homestyler.com/article/floorplanner/building-the-perfect-farmhouse-dining-table
- Chabudai: https://en.wikipedia.org/wiki/Chabudai, https://www.custommade.com/japanese-chabudai-a-low-folding-table/by/dogwood-design/
- Edges: https://www.finewoodworking.com/project-guides/tables-and-desks/the-right-edge-for-your-tabletop,
  https://woodsmith.com/article/selecting-table-edge-profiles
- Mid-poly and baking: https://polycount.com/discussion/226348/baking-normal-maps-of-an-angle,
  https://polycount.com/discussion/136610/question-about-baking-high-to-low
- Grain-aligned UVs: https://bigboomathighnoon.blogspot.com/2017/10/blog-post.html,
  https://documentation-a5um7gq0g-babylonjs.vercel.app/preparingArtForBabylon/planningMeshUVs
- Wood detail: https://blog.therookies.co/2019/04/04/how-to-create-a-procedural-material-in-substance-designer/,
  https://www.adobe.com/learn/substance-3d-designer/web/mark-foreman-s-substance-3d-designer-tips-and-tricks,
  https://gamesartist.co.uk/frozen-material-abderrezak-b/, https://shape-shift.gumroad.com/l/vvIWd,
  https://blendermarket.com/products/cg-lion-wood-presets-pack-1/docs,
  https://research.cs.cornell.edu/wood/simulating_the_structure_and_texture_of_solid_wood.pdf
- Chairs: https://designingidea.com/types-of-dining-chairs, https://furniture.com/inspiration/dining-chair-style-guide,
  https://ms-kb.msd.unimelb.edu.au/machine-workshop/making/step-by-step/designing/designing-for-making/ergonomics-and-product-interactions,
  https://www.livarea.de/en/trendblog/dining-room-ergonomics
- Cushions: https://www.blendernation.com/2021/08/04/pillows-and-cloth-blender-tutorial/,
  https://imeshh.com/blog/blender-28-pro-sofa-modeling-guide-part-4-fabric-cushion-sim,
  https://developer.blender.org/rBf6cefbef22c8, https://polycount.com/discussion/216237/cushion-couch-technique,
  https://www.fab.com/listings/7a883c3a-a3dd-4df1-b800-beb6d4b1ae18,
  https://www.blendernation.com/2020/05/26/cloth-retopology-for-game-asset-creation-promoted/
