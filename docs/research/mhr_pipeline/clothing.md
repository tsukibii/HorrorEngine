# Clothing: from GarmentCode sewing patterns to finished, fitted, moving garments on MHR characters in UE 5.8

Research date 2026-10-21. Network note: the session's proxy blocked dev.epicgames.com, forums.unrealengine.com,
docs.blender.org, ambientcg.com, fab.com, cgchannel.com and nccastaff.bournemouth.ac.uk for direct fetching. Findings
from those domains come from domain-restricted search results that summarise and quote the pages, so wording may be
paraphrased. GarmentCode was shallow-cloned and read at source level. Licence files were read raw from GitHub. Project
facts come from this repo (`tools/garment.py`, `tools/body/mhr.py`, `docs/METAHUMAN_ROUTE.md` §6).

## 1. Draping and sewing simulation from panels + seams: which simulator can we use?

### Takeaway
GarmentCode's code is MIT, and its box-mesh generator (seams welded, UVs per panel) does not need any simulator. Its
draping simulator is different: it is a fork of NVIDIA Warp 1.0.0-beta.6 under the **NVIDIA Source Code License, for
research or evaluation only**, so as it stands it cannot be used to make assets for a commercial game. Simulators that
are safe for commercial use:
- **Blender cloth with sewing springs:** built in, scriptable and headless. The quickest to get working.
- **Newton:** Apache-2.0, the successor to `warp.sim`, with XPBD, VBD and Style3D cloth solvers. The place to port
  GarmentCode's simulator to.
- **ContourCraft / ContourCraft-CG:** the code is MIT, and ChatGarment already uses it to drape GarmentCode patterns.
  The SMPL-X downloads and the licence of the trained weights still need checking.

Unreal's Chaos Cloth Dataflow takes a garment in one of two forms: a welded 3D mesh with the 2D pattern in a UV
channel, or a USD file with sewings exported from Marvelous Designer or CLO. It simulates a garment that is already
sewn. I found nothing showing it sewing flat panels together from scratch the way Marvelous Designer does.

### Cited Findings
**GarmentCode: what ships, and how its simulator works**
- The repo is MIT ("Copyright (c) 2024 Maria Korosteleva"). It contains the PyGarment library, garment programs, a GUI
  (now NiceGUI in the browser), `pattern_sampler.py`, `pattern_fitter.py`, `pattern_data_sim.py`, `test_garment_sim.py`
  and Maya+Qualoth legacy tools — [GarmentCode repo](https://github.com/maria-korosteleva/GarmentCode),
  [LICENSE](https://github.com/maria-korosteleva/GarmentCode/blob/main/LICENSE),
  [CHANGELOG](https://github.com/maria-korosteleva/GarmentCode/blob/main/CHANGELOG.md)
- Simulation uses "our fork of NVIDIA Warp simulator", which "should be installed manually"; the pipeline is "Sampling
  sewing pattern designs from template" then "Draping each over the base body (physics simulation)"; config holds
  fabric/body material properties, mesh resolution, quality-check thresholds (e.g., "skirt sliding down to the legs;
  heavy self-intersections") and render setup —
  [Running_data_generation.md](https://github.com/maria-korosteleva/GarmentCode/blob/main/docs/Running_data_generation.md),
  [Installation.md](https://github.com/maria-korosteleva/GarmentCode/blob/main/docs/Installation.md)
- `pattern_fitter.py` fixes a design and varies only the body shape, producing one pattern per body: GarmentCode's own
  "fit to many bodies" path —
  [Running_data_generation.md](https://github.com/maria-korosteleva/GarmentCode/blob/main/docs/Running_data_generation.md)
- How it sews: `BoxMesh.collapse_stitch_vertices()` merges matched stitch vertices into one welded "box mesh". Panels are
  triangulated with CGAL constrained Delaunay, and `mesh_resolution = 1.0` means vertices about 1 cm apart. The box mesh
  stores per-panel texture coordinates. `boxmeshgen.py` imports igl, numpy, svgpathtools, CGAL and matplotlib, and
  **does not import warp**. So welded, UV'd garment meshes can be made with MIT code alone —
  [boxmeshgen.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/pygarment/meshgen/boxmeshgen.py)
- The simulator reads a body segmentation file. `ggg_body_segmentation.json` labels the body's vertices as body,
  left_arm, right_arm, left_leg, right_leg and face_internal. These labels drive the "body-part drag" (pulling panels
  toward their body part) and the arm and face collision filters. The default body is `mean_all.obj` (GarmentCode's own
  body model), with an SMPL variant. The draped result is written as `<name>_sim.obj` and carries the box mesh's
  texture coordinates — [meshgen/garment.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/pygarment/meshgen/garment.py),
  [sim_config.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/pygarment/meshgen/sim_config.py),
  [test_garment_sim.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/test_garment_sim.py)
- Default simulation settings: max_sim_steps 2400, max_sim_time 600 s, triangle-particle and edge-edge self-collision
  on, attachment constraint on, fabric_thickness 0.1 —
  [default_sim_props.yaml](https://github.com/maria-korosteleva/GarmentCode/blob/main/assets/Sim_props/default_sim_props.yaml)
- 2.0.0 (2024-08-30) added box meshes, the Warp sim, labels "utilized to guide the cloth simulation process", and
  explicit right-to-right/right-to-wrong stitch orientation; 2.0.2 (2025-04-18): "UVs are now preserving the aspect
  ratio of the garment panels" — [CHANGELOG](https://github.com/maria-korosteleva/GarmentCode/blob/main/CHANGELOG.md)
- Bundled bodies: the files with "smpl" in their name are based on SMPL's average bodies, which the readme says are
  "licensed under CC BY 4.0". The others come from the GarmentMeasurements body model —
  [assets/bodies/Readme.md](https://github.com/maria-korosteleva/GarmentCode/blob/main/assets/bodies/Readme.md).
  GarmentMeasurements is GPL-3.0 —
  [GarmentMeasurements LICENSE](https://github.com/mbotsch/GarmentMeasurements/blob/main/LICENSE)

**GarmentCode's simulator licence: non-commercial**
- The NvidiaWarp-GarmentCode fork is based on Warp v1.0.0-beta.6. It adds to the XPBD solver: point-triangle and
  edge-edge self-collisions, equality and inequality attachment constraints (e.g., "fixing a skirt at the waist"),
  body-part drag, and pushing cloth out of the body. It builds with GCC ≥ 7.2 and CUDA ≥ 11.5 on Linux. The README says
  "the license currently allows only non-commercial use of this code" and "Later revisions of the license expand the
  use of warp to commertial use", and that the authors "follow the NVIDIA licensing decision" —
  [NvidiaWarp-GarmentCode](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode)
- LICENSE.md §3.3: "The Work and any derivative works thereof only may be used or intended for use non-commercially …
  'non-commercially' means for research or evaluation purposes only" —
  [fork LICENSE.md](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode/blob/main/LICENSE.md)

**Upstream Warp now, and Newton**
- Warp's CHANGELOG, [1.6.2] 2025-03-07: "Update project license from NVIDIA Software License to Apache License,
  Version 2.0". Later releases deprecated `warp.sim` ("planned for removal in v1.10") and then removed it: "This module
  has been superseded by the Newton library" — [Warp CHANGELOG](https://github.com/NVIDIA/warp/blob/main/CHANGELOG.md),
  [Warp LICENSE.md](https://github.com/NVIDIA/warp/blob/main/LICENSE.md),
  [heise on the open-sourcing](https://heise.de/-10381872)
- Newton is Apache-2.0 and a Linux Foundation project, started by Disney Research, Google DeepMind and NVIDIA and built
  on Warp. Its solvers include XPBD, VBD and Style3D, and it ships a `cloth_style3d` example. Isaac Lab's docs still
  call the framework beta and the VBD cloth solver experimental — [Newton LICENSE.md](https://github.com/newton-physics/newton/blob/main/LICENSE.md),
  [Newton on PyPI](https://pypi.org/project/newton/),
  [Linux Journal](https://www.linuxjournal.com/content/linux-foundation-welcomes-newton-next-open-physics-engine-robotics),
  [Isaac Lab Newton backend](https://isaac-sim.github.io/IsaacLab/v3.0.0-beta2/source/overview/core-concepts/physical-backends/newton/index.html)

**Blender cloth (built in, GPL tool, outputs are ours)**
- Sewing springs are extra edges that belong to no face and connect the vertices to be pulled together. "Max Sewing
  Force" of 0 means unbounded, which is "not recommended … instability due to extreme forces in the initial frames".
  Shrinking should be keyframed, easing in from 0 during draping — [Blender 5.2 manual: Cloth Shape](https://docs.blender.org/manual/en/latest/physics/cloth/settings/shape.html),
  [2.79 cloth settings](https://docs.blender.org/manual/en/2.79/physics/cloth/settings/cloth_settings.html)
- Scriptable: `ClothSettings.sewing_force_max` (0–10000), `shrink_min`/`shrink_max` —
  [ClothSettings API](https://docs.blender.org/api/current/bpy.types.ClothSettings.html)

**Unreal Chaos Cloth: Panel Cloth / Dataflow**
- UE 5.3 introduced the Chaos Cloth Panel node editor, a non-destructive Dataflow graph. Two input routes: (a) separate
  render and simulation static meshes exported as FBX, or (b) a USD file from Marvelous Designer or CLO containing a
  sim and a render mesh, read by a USDImport node —
  [Panel Cloth Editor Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/panel-cloth-editor-overview),
  [Panel Cloth 5.4 updates](https://dev.epicgames.com/community/learning/tutorials/0Ja6/unreal-engine-panel-cloth-dataflow-and-collision-updates-5-4)
- `StaticMeshImport_v2` has a `UVChannel` ("UV channel of the static mesh to import the 2D simulation mesh patterns
  from") and a `UVScale` ("Apply this scale to the UVs when populating Sim Mesh positions"). The skeletal-mesh import
  node has the same two settings. `FClothGeometryTools` has `BuildSimMeshFromDynamicMesh` (unwrap and build the sim
  mesh from a UV channel and scale) and `BuildConnectedSeams2D` —
  [StaticMeshImport_v2 API](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAssetDataflowNodes/FChaosClothAssetStaticMeshImport-?lang=en-US),
  [FClothGeometryTools](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAsset/FClothGeometryTools?lang=en-US)
- The USD cloth data struct carries RenderPatterns, RenderToSimPatterns, **Sewings** and SimPatternFabricIndices —
  [FChaosClothAssetUsdClothData](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAssetDataflowNodes/FChaosClothAssetUsdClothData?lang=en-US)
- Cloth patterns are stored in 2D and unwelded, while the simulation runs on a welded 3D mesh. The API keeps a map from
  pattern (unwelded) vertices to welded vertices —
  [FClothPatternToDynamicMesh](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAssetTools/FClothPatternToDynamicMesh?lang=en-US),
  [EClothPatternVertexType](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAssetTools/UE__Chaos__ClothAsset__EClothPat-?lang=en-US)
- Status by version:
  - **5.6:** "Beta Chaos Cloth Panel Editor … Experimental Unified Dataflow Editor, the concept of an Outfit Asset with
    resizing/refitting" — [Chaos Cloth Updates 5.6](https://dev.epicgames.com/community/learning/tutorials/LZZo/unreal-engine-epic-games-store-chaos-cloth-updates-5-6)
  - **5.8:** the Chaos Dataflow Cloth Editor is "Production-Ready and is now the default cloth editor". 5.8 also brings
    weight-map painting updates, new nodes for vertex and texture map import, and USD updates. Chaos Cloth itself is
    production-ready and "supports round-tripping of assets with Marvelous Designer" —
    [Chaos Cloth Updates 5.8](https://dev.epicgames.com/community/learning/tutorials/Wb2V/unreal-engine-chaos-cloth-updates-5-8),
    [5.8 tutorial thread](https://forums.unrealengine.com/t/tutorial-chaos-cloth-updates-5-8/2729420),
    [UE 5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes?lang=en-US),
    [UE 5.8 announcement](https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available)
- Practitioner report: Unreal's native cloth solver "isn't designed to drape high-res self-colliding cloth". The author
  draped in Marvelous Designer instead and brought the result in as Alembic —
  [Versluis 2025](https://www.versluis.com/2025/06/alembic-workflow-from-iclone-to-md-to-ue-via-blender/)
- An MSc thesis (Liebner, Bournemouth, 22 Aug 2025) built a UE5 plugin that combines 2D pattern drafting, automatic mesh
  generation and Chaos Cloth simulation. Its abstract calls pattern authoring and mesh generation "robust and
  performant"; the snippet cut off before its conclusions on seam constraints —
  [thesis PDF](https://nccastaff.bournemouth.ac.uk/jmacey/MastersProject/MSc25/08/Marisa_Thesis_final.pdf)

**Research simulators (licence and fit)**
- **ContourCraft:** MIT, supports SMPL-X and SMPL — [ContourCraft](https://github.com/Dolorousrtur/ContourCraft).
  **ContourCraft-CG:** MIT; "Allows simulation from arbitrary body mesh and starting pose" and adds Blender rendering.
  Its install follows the original repo's data downloads — [ContourCraft-CG](https://github.com/biansy000/ContourCraft-CG).
  **ChatGarment:** Apache-2.0, text or image to GarmentCode pattern, uses ContourCraft-CG "for garment simulation" —
  [ChatGarment](https://github.com/biansy000/ChatGarment). The ContourCraft paper itself is listed as CC BY-NC-SA (the
  paper, not the code) — [OpenAlex](https://api.openalex.org/works/doi:10.1145%2F3641519.3657408)
- **HOOD:** MIT code. It needs the SMPL model files downloaded from smpl.is.tue.mpg.de. Since 30.09.2023 it can run
  "with any mesh sequence or SMPL pose sequence from a garment mesh in arbitrary pose", and new garments can come from
  .obj — [HOOD](https://github.com/Dolorousrtur/HOOD), [paper](https://arxiv.org/abs/2212.07242)
- **Codim-IPC:** Apache-2.0 — [Codim-IPC](https://github.com/ipc-sim/Codim-IPC). **libuipc:** Apache-2.0 —
  [libuipc](https://github.com/spiriMirror/libuipc). **GarmentLab:** no licence file found at the usual paths —
  [GarmentLab](https://github.com/GarmentLab/GarmentLab)

**Paid tools**
- **Marvelous Designer 2026.1:**
  - **Personal:** $39/month or $280/year. Linux is not included.
  - **Enterprise:** $199/month or $2,000/year for Windows and macOS; $2,300/year with the Linux edition, which
    supports RHEL/Rocky Linux 9.5+. The Linux edition has been available since October 2025, and only on Enterprise
    floating licences.
  - **Indie:** for studios with at least 2 staff and under $500k a year; price not disclosed.
  - Sources: [CG Channel, MD 2026.1](https://www.cgchannel.com/2026/08/clo-virtual-fashion-releases-marvelous-designer-2026-1/),
    [CG Channel, MD for Linux](https://www.cgchannel.com/2025/10/marvelous-designer-is-now-available-for-linux/)
- **MD 2024.0 added EveryWear:** "automate the process of optimizing clothing for games and real-time use", covering
  fitting and rigging to the avatar, texture baking and LOD creation, plus LiveSync to Unreal —
  [CG Channel, MD 2024.0](https://www.cgchannel.com/2024/04/clo-virtual-fashion-releases-marvelous-designer-2024-0/),
  [Renderu](https://renderu.com/en/news/post/25190)
- **Style3D:** on a free trial, "commercial deployment is typically not allowed". A commercial licence allows games,
  including through the Style3D Simulator plugin for Unreal —
  [Style3D blog, who owns the models](https://www.style3d.com/blog/?p=14316). This conflicts with a Style3D marketing
  post saying the free Studio plan allows commercial use —
  [Style3D blog, free apps](https://www.style3d.com/blog/?p=6422).
  Free Atelier release coverage: [80.lv](https://80.lv/articles/this-new-garment-modeling-software-has-released-free-version)

**Licence sort (the items above)**

| Allowed for commercial use, free | Non-commercial only | Paid | Unclear |
|---|---|---|---|
| GarmentCode/PyGarment incl. box mesh (MIT); Warp ≥ 1.6.2 (Apache-2.0); Newton (Apache-2.0); Blender (GPL tool); ContourCraft, ContourCraft-CG, HOOD code (MIT, but SMPL/SMPL-X model files required); ChatGarment (Apache-2.0); Codim-IPC, libuipc (Apache-2.0); Unreal's Chaos Cloth, Dataflow, Outfit Asset (UE EULA) | NvidiaWarp-GarmentCode, i.e. GarmentCode's built-in draping (NVSCL §3.3) | Marvelous Designer; Style3D (commercial licence); CLO (not researched) | GarmentLab (no licence file); trained weights of ContourCraft/HOOD (no licence stated); SMPL/SMPL-X terms for use in a pipeline |

### Inferences
- **The project doc needs two corrections.** `docs/METAHUMAN_ROUTE.md` §6 says GarmentCode's licence "needs checking".
  The code is MIT, but its draping simulator is non-commercial. The same doc says the Dataflow cloth editor was beta in
  5.7; Epic's 5.6 tutorial already calls it beta in 5.6.
- **GarmentCode's draping simulator is still useful for the look-test.** It is the reference for how these patterns
  should drape, and it builds on Linux with CUDA on a 3090. It must not produce shipped assets unless either the author
  relicenses the fork (her README suggests she follows NVIDIA, who went Apache-2.0), or its XPBD changes are written
  again on Newton or Warp ≥ 1.6.2. Note that 1.6.2 to 1.9.x still has `warp.sim`; later versions don't. That rewrite is
  a few hundred lines: attachment constraints, body-part drag, push-out of the body, plus Newton's own self-collision.
- **The commercial-safe route available today is Blender.** The project's `garment.py panels` already writes the
  unwelded panels placed round the body plus a `.seams.json`. Turning each seam pair into a loose edge gives Blender's
  sewing springs. The cast member's MHR body (OBJ/FBX) is the collision object, and the script ramps sewing force and
  shrink, then welds the seam vertices by distance after the drape. All of it runs in headless bpy.
- **Rest lengths differ by simulator.** In Blender, the rest shape is the flat-panel geometry, which is why sewing
  springs are needed. In Chaos, the 2D pattern in a UV channel gives the rest lengths and the welded 3D mesh gives the
  topology. GarmentCode's box mesh is a welded *start* state (seams collapsed, panels distorted near the seams), not a
  draped result, so it suits Warp, Newton or Chaos but not plain Blender cloth.
- **Unreal's import probably wants a welded mesh, not separate panels plus a seams file.** The static-mesh import reads
  the 2D pattern from a UV channel, and patterns are unwelded while the simulation is welded. So the simplest input is a
  draped, welded mesh with a UV channel holding each panel's flat 2D coordinates in cm (`UVScale` maps them to sim
  positions), and a second UV channel packed for textures. The seams then come from vertices that share a 3D position
  but sit on different UV islands. This needs one test. If it fails, the fallback is to write USD with `Sewings`, as
  Marvelous Designer does.
- **Chaos should relax and run a draped garment, not do the first drape.** Draping from flat panels in Unreal is the
  weakest option: nothing documents it, and practitioners say the solver isn't built for high-res self-colliding
  draping.
- **ContourCraft-CG is the strongest learned option.** It is already wired to GarmentCode patterns through ChatGarment
  and accepts arbitrary bodies, so MHR works. It needs the SMPL-X files only for its environment and examples, and that
  dependency plus the weights' terms must be cleared first. HOOD fits better for dynamic sequences (cutscene cloth) than
  for the first drape.

### Gaps
- No Epic page reachable in this session shows static-mesh sewing working, i.e. seams inferred from welded vertices
  across UV islands. That stays an inference until the first import.
- The USD schema Marvelous Designer writes for Chaos (sim and render patterns, sewings) was not found documented, so
  writing GarmentCode USD directly is unscoped.
- The thesis's results on seams and its Chaos integration sections (4.7, 4.8) could not be read: the domain is blocked.
- Whether the ContourCraft/HOOD pretrained weights carry their own terms, and the current SMPL/SMPL-X licence terms, were
  not verified. GarmentCode's readme calling SMPL's average bodies CC BY 4.0 is their statement and was not checked
  against the SMPL site.
- Marvelous Designer Personal's commercial-use terms were not confirmed. CLO was not researched.
- No timing numbers for Blender cloth or GarmentCode's simulator on a dense (~1 cm) garment were found. Expect minutes
  per drape (estimate).

## 2. Fitting one garment to many body shapes

### Takeaway
There are two routes:
- **Made to measure:** regenerate the GarmentCode pattern from each cast member's measures and drape again. This is
  GarmentCode's own fitting model and gives the truest fit.
- **Morph one drape onto other bodies:** bind it to a base body and deform. Because every MHR body is the same mesh
  with different vertex positions, this is unusually robust for us.

Unreal's Outfit Asset does the morph route with RBF interpolation between source and target skeletal meshes. It is
documented around MetaHuman bodies, and in 5.6 resizing overwrites custom skinning with a simple weight transfer. It is
the native route if the final characters are MetaHumans. Using it on raw MHR skeletal meshes is plausible but untested.

### Cited Findings
- MetaHuman parametric clothing "warps clothing based on the difference between a source body and a target body". Epic
  advises multiple outfits for multiple source bodies, because warping is worse for detailed clothing when the shapes
  differ a lot — [Getting Started for Parametric Clothing in MetaHuman](https://dev.epicgames.com/documentation/metahuman/getting-started-for-creating-parametric-clothing-in-metahuman)
- Each size pairs one cloth asset with one source body at the same index. Epic recommends at least two source bodies:
  "the more source bodies you have, the higher the quality" —
  [Create a MetaHuman Parametric Outfit Asset](https://dev.epicgames.com/documentation/metahuman/create-a-metahuman-parametric-outfit-asset?lang=en-US).
  A resizable outfit "automatically selects the size that fits the best in accordance with the target body's
  measurements", and the choice can be overridden — [Tailoring Your Own Wardrobe Items](https://dev.epicgames.com/documentation/metahuman/tailoring-your-own-wardrobe-items)
- Num Resizing Interpolation Points: about 1000–2500, default 1500 —
  [Create a MetaHuman Parametric Outfit Asset](https://dev.epicgames.com/documentation/metahuman/create-a-metahuman-parametric-outfit-asset?lang=en-US).
  Raising it costs generation time and disk; if results stay poor, add a size instead. `source_body_parts` is "usually
  one single MetaHuman merged body+head skeletal mesh", and `source_asset` must be "the exact same garment
  representation for each specified sizes" — [ChaosSizedOutfitSource (Python API)](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/ChaosSizedOutfitSource)
- The ApplyResizing Dataflow node takes a source skeletal mesh, a target skeletal mesh and pre-computed RBF
  interpolation data ("Apply resizing for a given Target Mesh") —
  [FChaosClothAssetApplyResizingNode](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAssetDataflowNodes/FChaosClothAssetApplyResizingNod-?lang=en-US).
  CustomRegionResizing is experimental —
  [CustomRegionResizing](https://dev.epicgames.com/documentation/unreal-engine/node-reference/Dataflow/CustomRegionResizing?lang=en-US)
- In UE 5.6, resizable clothing does not support custom skinning, Control Rig or RBAN. On resize it "does a simple skin
  weight transfer from the body, and overwrites all of it" —
  [Getting Started with Parametric Clothing](https://dev.epicgames.com/documentation/unreal-engine/getting-started-with-parametric-clothing?lang=en-US)
- Weight-transfer limits can tear the armpits and upper thighs; the fix is to pre-paint skinning maps —
  [Building a MetaHuman Parametric Outfit with a Render Mesh](https://dev.epicgames.com/documentation/metahuman/building-a-metahuman-parametric-outfit-with-a-render-mesh?lang=en-US).
  Body clipping at the armpits or thigh gap causes resizing problems —
  [Creating Your MetaHuman Characters](https://dev.epicgames.com/documentation/metahuman/creating-your-metahuman-characters?lang=en-US).
  MetaHuman clothing for Fab must use the MetaHuman base skeleton or a very close variant, without reparenting —
  [Fab MetaHuman asset requirements](https://dev.epicgames.com/documentation/en-us/metahuman/asset-format-and-structure-requirements-for-metahumans-on-fab)
- A forum thread on UE 5.8: resizing works in MetaHuman Creator but the cloth simulation is lost when the outfit goes on
  a Chaos Cloth Component. Epic staff replied that the MetaHuman Creator Dataflow "strips out the sim mesh" and suggested
  two outfit assets (the reply was cut off) —
  [forum: resizing an Outfit Asset while preserving cloth simulation](https://forums.unrealengine.com/t/intended-workflow-for-resizing-a-chaos-outfit-asset-while-preserving-cloth-simulation/2762838)
- Blender Surface Deform: binding captures the current state against the target, so later edits to the target deform
  the bound mesh. The target cannot have edges shared by more than two faces, concave faces, overlapping vertices, or
  faces with collinear edges. It is scriptable (`surfacedeform_bind`, `is_bound`) —
  [Surface Deform (Blender 5.2 manual)](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html).
  Mesh Deform's Dynamic option takes "other mesh altering features (such as other modifiers and shape keys)" into
  account — [Mesh Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/mesh_deform.html)
- GarmentCode's `pattern_fitter.py` fixes the design and varies the body, producing a fitted pattern per body —
  [Running_data_generation.md](https://github.com/maria-korosteleva/GarmentCode/blob/main/docs/Running_data_generation.md)
- Our MHR bodies are one packed mesh: points, triangles and 45 identity shapes. Each body is the points with the
  identity weights applied — `tools/body/mhr.py` (this repo)

### Inferences
- **Shared topology makes everything per-body a one-time job.** Every cast member's body is the same MHR mesh, so:
  - GarmentCode's body segmentation is labelled once on MHR (which vertices are body, arms, legs, face) and works for
    every cast member.
  - A garment bound to the base body with Surface Deform follows any identity change exactly, because the target
    mesh's vertices move but its topology doesn't. MHR is triangulated, so there are no concave faces, which meets the
    bind rules.
  - Unreal's source and target bodies for the Outfit Asset's RBF can be any two MHR bodies.
- **Use made-to-measure for the main cast.** For each cast member and garment, the pattern comes from their measures,
  then the drape. It's fully automatic and a few minutes of compute.
- **Use morph-transfer for variants and extras.** Drape once on the nearest base (feminine, average, masculine:
  `MHR_presets.json`), then morph. Re-drape when the shapes differ a lot, which is Epic's own advice for detailed
  clothing.
- **If the final characters are MetaHumans,** author each garment once on two or more MetaHuman preset bodies as an
  Outfit Asset and let parametric resizing do the rest. Mind two things: the 5.6 limit that resizing overwrites custom
  skinning, and the 5.8 report of the simulation mesh being stripped in MetaHuman Creator.
- **If the final characters stay MHR skeletal meshes,** the Outfit Asset machinery (sized sources, ApplyResizing with
  RBF) looks generic, but Epic only documents MetaHuman bodies. A one-garment test on two MHR bodies would settle it.
  Doing the morph in Blender and exporting each cast member's fitted garment is the safe fallback.

### Gaps
- No documentation or user report was found of an Outfit Asset sized on non-MetaHuman source bodies, or of a runtime
  resize onto a custom skeletal mesh.
- Learned fitting methods (DrapeNet, SNUG and the like) were not surveyed. They are mostly SMPL-bound, and our shared
  topology makes them unnecessary.
- How Surface Deform treats shape keys at bind time is not stated in the manual. Practice is to bind on the base body,
  then change it, which is what the manual's bind semantics describe.

## 3. From simulated drape to game asset: thickness, UVs, textures, skin weights, poke-through, LODs

### Takeaway
GarmentCode gives natural UVs: per-panel islands in true proportions, carried through to the draped OBJ. Unreal's
Dataflow has a strong skin-weight transfer (weight inpainting, SIGGRAPH Asia 2023) and a Remesh path for LODs. CC0
fabrics come from ambientCG, and Poly Haven per a third-party guide. Hiding the body under clothing is done with masks,
as MetaHuman wardrobes do. Thickness, closures and fine detail are not in GarmentCode's output and have to be added in
Blender or through textures.

### Cited Findings
- Box-mesh UVs come from each panel's 2D coordinates, packed into islands with padding. Since 2.0.2 they preserve the
  panels' aspect ratio. The simulator's output OBJ keeps these texture coordinates —
  [boxmeshgen.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/pygarment/meshgen/boxmeshgen.py),
  [render/texture_utils.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/pygarment/meshgen/render/texture_utils.py),
  [CHANGELOG](https://github.com/maria-korosteleva/GarmentCode/blob/main/CHANGELOG.md),
  [meshgen/garment.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/pygarment/meshgen/garment.py)
- GarmentCode's vocabulary: shirts and fitted shirts (bodice), tee torso, sleeves with cuffs, collars (turtle, simple
  lapel, two-panel hood), skirts (circle, asymmetric circle, pencil, paneled, many-panels, tiered levels, godet), pants
  with cuffs, waistbands (straight, fitted), and a MetaGarment combining upper and lower (dresses, jumpsuits) —
  [garment_programs](https://github.com/maria-korosteleva/GarmentCode/tree/main/assets/garment_programs)
- The Dataflow **TransferSkinWeights** node copies a skeletal mesh's weights onto the sim mesh, the render mesh or both.
  Its default method, InpaintWeights, is based on "Robust Skin Weights Transfer via Weight Inpainting" (SIGGRAPH Asia
  2023); ClosestPointOnSurface is the simple alternative. Defaults: NormalThreshold 30°, RadiusPercentage 0.05 of the
  bounding-box diagonal, LayeredMeshSupport on, 10 smoothing iterations at 0.1, MaxNumInfluences 8. Inpainting works
  best on the welded, manifold sim mesh, because render meshes split along stitches can pick up different weights for
  nearby vertices. The output can feed a Remesh node for automatically generated LODs —
  [TransferSkinWeights node reference](https://dev.epicgames.com/documentation/unreal-engine/node-reference/Dataflow/TransferSkinWeights?lang=en-US)
- The same algorithm exists for Blender as the robust-weight-transfer add-on (GPL-3.0) —
  [robust-weight-transfer](https://github.com/sentfromspacevr/robust-weight-transfer)
- Panel Cloth recommends separate render and simulation meshes —
  [Panel Cloth Editor Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/panel-cloth-editor-overview).
  A ProxyDeformer node tells the cloth collection how the render mesh deforms during simulation —
  [Creating Clothing Assets for UEFN](https://dev.epicgames.com/documentation/en-us/fortnite/creating-clothing-assets-for-unreal-editor-for-fortnite-using-unreal-engine)
- Epic's UEFN modelling tips: weld pieces to avoid holes, keep the mesh continuous where possible, keep UV islands in the
  0–1 square with as few islands as possible, aim for about 1024 px/m texel density, and work mostly in quads —
  [Modeling Tips in UEFN](https://dev.epicgames.com/documentation/en-us/fortnite/modeling-tips-in-unreal-editor-for-fortnite)
- Epic's 5.6 wardrobe tutorial uses a mask to delete the body geometry under garments, which cuts polycount and
  interpenetration — [Optimizing MetaHuman Wardrobes in 5.6](https://dev.epicgames.com/community/learning/tutorials/1b7K/unreal-engine-optimizing-metahuman-wardrobes-in-metahuman-creator-in-5-6).
  Community practice: a transparent or opacity-masked body material where clothing covers the skin —
  [forum: body mesh depending on clothes](https://forums.unrealengine.com/t/metahumans-body-mesh-depeding-on-clothes/1661087)
- ambientCG: all assets are CC0 1.0, attribution not required —
  [ambientCG licence](https://docs.ambientcg.com/license/). Fabric sets are offered as JPG/PNG PBR packs from 1K to 8K,
  e.g. [Fabric 019, woven wool](https://ambientcg.com/view?id=Fabric019),
  [Fabric 004](https://ambientcg.com/view?id=Fabric004),
  [Fabric 081 C, plastisol print](https://ambientcg.com/view?id=Fabric081C); [ambientCG](https://ambientcg.com/)
- A third-party guide lists Poly Haven and ambientCG as CC0 and notes that fabric "depends heavily on its normal map"
  because the weave is too fine for the colour map. This is a weaker source —
  [cinevva free fabric textures](https://app.cinevva.com/game-assets/free-fabric-textures)

### Inferences
- **UVs: two channels.** UV0 holds the packed GarmentCode islands, for textures. UV1 holds each panel's flat
  coordinates in cm, for Chaos's pattern import with `UVScale` 1. The panel UVs are true to proportion, so a fabric set
  tiles at physical scale (e.g. a 50 cm swatch) with the grain following the panel, which is what a tailor would do.
  GarmentCode also writes a grain texture option (`fabric_grain_texture_path`).
- **Thickness.** GarmentCode garments are single-sided shells. Give the render mesh a small solidify (2–4 mm) in
  Blender, or a two-sided material with a rolled hem strip, and keep the sim mesh single-layer.
- **Detail.** Topstitching and hem lines can be generated: GarmentCode knows every seam and hem edge, so a script can
  draw stitch lines into a normal or mask texture in UV0. Buttons and zips are separate small rigid meshes skinned to
  the nearest bone.
- **Density and LODs.** The 1 cm box mesh is the render-mesh source. The sim mesh should be much coarser (about 2–4 cm
  edges, via Remesh), driven through the proxy deformer. LOD1+ come from the Remesh node, with cloth off at far LODs.
- **Hiding the body.** MHR's topology is shared, so a garment design's "covered triangles" mask is computed once (by
  ray-cast or distance from the drape to the body) and applies to every cast member. Use it to delete triangles, or
  write a vertex-colour or texture opacity mask on the body material.
- **Skin weights.** Run TransferSkinWeights (inpaint) from the body's skeletal mesh onto the welded sim mesh, then let
  the proxy deformer carry them to the render mesh. Pre-paint the armpits and crotch where Epic warns of tearing.
- **Textures.** The project's PBR shelf (`Content/Studio/PBR/`) is the natural home for the fabric sets
  (`pbr/Fabric/<name>`).

### Gaps
- How well the Dataflow Remesh node and Proxy Deformer cope with a 1 cm GarmentCode render mesh, and what triangle
  budget to aim for per garment, were not found.
- Poly Haven's own fabric catalogue and licence page were not fetched (only the third-party summary).
- Whether 5.7/5.8 MetaHuman outfits hide the body automatically (rather than by hand-made masks) was not confirmed.

## 4. Runtime motion: Chaos Cloth vs bone chains vs ML Cloth vs baked caches

### Takeaway
In 5.8, Chaos Cloth and its Dataflow editor are production-ready. Per-garment cost is anecdotal:
- about 0.35 ms per asset once optimised;
- 1–3 ms per character with heavy defaults (unverified);
- the CPU carries the load.

A few close-up characters are affordable. Cheaper choices, from simplest:
- **Tight garments:** skinning only.
- **Skirts:** Kawaii Physics bone chains (MIT, UE 5.3–5.8) or AnimDynamics (built in, no collision).

ML Cloth (Chaos Cloth Generator plus ML Deformer) is still flagged experimental and only predicts quasi-static wrinkles
on tight clothing. For cutscenes, bake to an Alembic Geometry Cache, keeping in mind a 5.8 import crash report.

### Cited Findings
- Chaos Cloth is production-ready in 5.8, and the Dataflow Cloth Editor is the default —
  [Chaos Cloth Updates 5.8](https://dev.epicgames.com/community/learning/tutorials/Wb2V/unreal-engine-chaos-cloth-updates-5-8),
  [UE 5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes?lang=en-US)
- Cost, all anecdotal:
  - about 0.35 ms per asset at LOD0 after a sim proxy, a remesh, and substeps and iterations set to 1 —
    [forum: low-budget Chaos Cloth](https://forums.unrealengine.com/t/how-to-setup-low-budget-chaos-cloth-sim/2701370)
  - "1–3 ms per character" with default assets, full self-collision and a dense sim mesh; the claimed forum source
    wasn't found — [PerfGuard](https://getperfguard.com/tutorials/chaos-physics)
  - an outlier of ~80 ms for a ~350-vertex cape —
    [forum](https://forums.unrealengine.com/t/cloth-sim-and-solver-taking-80ms-each-moving-causes-drop-to-15fps-urgent-will-pay-for-a-solution-by-zelle-paypal/1308282)
  - Chaos is CPU-heavy with "minimal GPU acceleration" — [Puget Systems](https://www.pugetsystems.com/?p=50345)
- Optimisation levers: MaxIterations 1, Backstop instead of collision capsules, self-collision only where intersections
  show, `stat ChaosCloth` to profile —
  [community optimisation guide](https://forums.unrealengine.com/t/community-tutorial-a-guide-to-cloth-animation-optimization-in-unreal-engine/2729568),
  [PerfGuard](https://getperfguard.com/tutorials/chaos-physics)
- **ML Cloth:** the Chaos Cloth Generator plugin is labelled Experimental —
  [Chaos Cloth Generator plugin](https://dev.epicgames.com/documentation/unreal-engine/API/PluginIndex/ChaosClothGenerator?lang=en-US).
  It "simulates the cloth and generates a Geometry Cache". The clothing "is assumed to be quasi-static": the system
  predicts wrinkles but not "swinging or draping", and is "best suited for tight-fitting clothing" —
  [ML Cloth overview](https://dev.epicgames.com/documentation/unreal-engine/machine-learning-cloth-simulation-overview).
  A 5.3.2 report: vertex-count mismatch when two disconnected garments sat on one skeletal mesh, fixed by splitting
  them — [forum](https://forums.unrealengine.com/t/chaos-cloth-generator-generated-cache-mismatchting-vertex-count-when-using-ml-deformer/1776305).
  A personal blog lists ML items as experimental in 5.5/5.6 and beta in 5.7; this is unverified —
  [Medium pipeline reference](https://medium.com/@Jamesroha/metahuman-5-6-5-7-pipeline-reference-170d302b078e)
- **Kawaii Physics:** UE 5.3–5.8, C++ source under MIT, aimed at "hair, skirts, and accessories" —
  [Fab listing](https://www.fab.com/listings/f870c07e-0a02-4a78-a888-e52a22794572). The GitHub release is MIT; the Fab
  version is under the Fab Standard License (v1.19.1, July 2025) —
  [CG World](https://cgworld.jp/flashnews/01-202507-KawaiiPhysics-v1191.html). Repo:
  [pafuhana1213/KawaiiPhysics](https://github.com/pafuhana1213/KawaiiPhysics)
- **AnimDynamics:** "a light-weight physics simulation solution" with its own boxes for inertia. "Collision is not
  calculated; instead, constraints can be used". Chains are "much more expensive than a single body" because linked
  constraints need many iterations —
  [AnimDynamics (UE5)](https://dev.epicgames.com/documentation/unreal-engine/animation-blueprint-animdynamics-in-unreal-engine),
  [AnimDynamics (4.27)](https://docs.unrealengine.com/4.27/en-US/AnimatingObjects/SkeletalMeshAnimation/NodeReference/SkeletalControls/AnimDynamics)
- **Alembic:** imports as a Geometry Cache for vertex-varying playback. Only three- and four-sided polygons are
  accepted — [Alembic importer](https://dev.epicgames.com/documentation/unreal-engine/alembic-file-importer-in-unreal-engine),
  [4.26 doc](https://docs.unrealengine.com/4.26/WorkingWithContent/Importing/AlembicImporter).
  A UE 5.8 report of the editor crashing on Alembic cloth import as a Geometry Cache (a Windows path) —
  [forum](https://forums.unrealengine.com/t/editor-crashes-when-importing-alembic-cloth-as-geometry-cache-array-index-out-of-bounds-2147483647-into-array-of-size-2/2840452).
  An old 4.14 report of a self-built Linux editor not offering .abc —
  [answers](https://answers.unrealengine.com/questions/525850/view.html?sort=votes).
  The draped-in-Marvelous-Designer, then Alembic, route is used in practice —
  [Versluis 2025](https://www.versluis.com/2025/06/alembic-workflow-from-iclone-to-md-to-ue-via-blender/)

### Inferences
- **Tier garments by fit and screen time, consistent with METAHUMAN_ROUTE §6 ("physics live").**
  - **Tight garments** (tees, fitted shirts, pants): skinned only, no simulation; optionally ML Cloth wrinkles later.
  - **Loose garments** (skirts, dresses, coats, hoods down): Chaos Cloth on a coarse sim mesh, self-collision off,
    1 iteration, backstop.
  - **Background characters:** Kawaii Physics chains on two or three added skirt bones.
- **The budget works.** A first-person horror scene has one to three cast members up close. At 0.35–1 ms per loose
  garment that fits a 3090-class PC. The player's own clothing is barely seen (METAHUMAN_ROUTE §6).
- **Cutscenes.** Use live Chaos where it holds up. For hero shots, bake: simulate the shot's body motion in Blender (or
  later Newton or HOOD) on the high-res garment and import it as Alembic. That avoids the "not designed for high-res
  self-colliding" limit, at the price of a Geometry Cache per shot. Test Alembic import on the Linux 5.8.3 editor first.
- **ML Cloth stays an optional optimisation.** It does not help skirts.

### Gaps
- No authoritative Epic per-garment cost or threading description for Chaos Cloth was found. The CPU-only claim rests
  on Puget's general Chaos statement.
- ML Cloth / Chaos Cloth Generator status in 5.7–5.8, and whether ML Deformer training runs in the Linux editor (it uses
  Python and PyTorch), were not confirmed.
- No documented in-engine route to bake a Chaos Cloth simulation to a Geometry Cache was found. The Chaos Cache Manager
  plugin found covers geometry collections, not cloth.
- KawaiiPhysics' LICENSE file was not found at `main/LICENSE`; the MIT claim rests on the Fab listing and CG World.

## 5. Per-garment workflow, manual work, and how good it can look against MetaHuman clothing and Marvelous Designer

### Takeaway
A mostly automatic pipeline is realistic:
1. GarmentCode pattern from the cast member's measures.
2. Offline drape (Blender now; a Newton port of GarmentCode's simulator later).
3. Welded mesh with pattern UVs.
4. Unreal Dataflow template (pattern from UV, skin-weight inpaint, Remesh LODs, Chaos settings).
5. CC0 fabric.

Once the template exists, a new garment for a cast member should take about an hour of attention, mostly checking. It
will look like clean, well-proportioned basic clothing. It won't match Epic's Marvelous-Designer-made MetaHuman outfits
or a skilled MD artist's work: GarmentCode has no closures, pockets, layers, pleats or sculpted wrinkles. Close-ups need
added detail (stitch normals, thickness, buttons), and a pleated school skirt needs a new garment program.

### Cited Findings
- Epic builds MetaHuman parametric outfits from DCC output: USD from Marvelous Designer or CLO, or FBX and render-mesh
  routes —
  [Building a MetaHuman Parametric Outfit with a USD Export](https://dev.epicgames.com/documentation/metahuman/building-a-metahuman-parametric-outfit-with-a-usd-export?lang=en-US),
  [with an FBX Export](https://dev.epicgames.com/documentation/metahuman/building-a-metahuman-parametric-outfit-with-an-fbx-export?lang=en-US),
  [with a Render Mesh](https://dev.epicgames.com/documentation/metahuman/building-a-metahuman-parametric-outfit-with-a-render-mesh?lang=en-US),
  [Building an Outfit Asset in UE](https://dev.epicgames.com/documentation/unreal-engine/building-an-outfit-asset-in-unreal-engine)
- Marvelous Designer's EveryWear automates fitting and rigging to the avatar, texture baking and LODs, and LiveSync
  links it to Unreal — [CG Channel, MD 2024.0](https://www.cgchannel.com/2024/04/clo-virtual-fashion-releases-marvelous-designer-2024-0/),
  [Renderu](https://renderu.com/en/news/post/25190),
  [Marvelous Designer guide](https://www.marvelousdesigner.com/explore/guide/best-3d-cloth-simulation-clothing-design-software-2026).
  Chaos Cloth in 5.8 round-trips with Marvelous Designer —
  [UE 5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes?lang=en-US)
- GarmentCode 2.0 reworked its garment programs for "better fit, balance and 3D alignment" and fewer invalid parameter
  combinations, and its simulator rejects failed drapes with quality checks —
  [CHANGELOG](https://github.com/maria-korosteleva/GarmentCode/blob/main/CHANGELOG.md),
  [Running_data_generation.md](https://github.com/maria-korosteleva/GarmentCode/blob/main/docs/Running_data_generation.md)
- The vocabulary, listed in §3, has no pleats, buttons or zips, plackets, pockets or linings —
  [garment_programs](https://github.com/maria-korosteleva/GarmentCode/tree/main/assets/garment_programs)
- Unreal's solver is not meant for high-res self-colliding draping; practitioners drape in Marvelous Designer —
  [Versluis 2025](https://www.versluis.com/2025/06/alembic-workflow-from-iclone-to-md-to-ue-via-blender/)
- In this repo, `tools/garment.py` makes the pattern and the placed panels (OBJ plus `.seams.json`) from a cast member's
  measures (tested on Mari's t-shirt: 8 panels, 220 vertices, 16 stitches). The Unreal import is the untested half
  (SETUP S12) — `tools/garment.py`, `docs/METAHUMAN_ROUTE.md` §6

### Inferences
- **Suggested per-garment workflow.** Steps A, B, D and E are automatic once built; C is optional.
  - **0. Once:**
    - label MHR vertices with GarmentCode's six body parts;
    - build one Unreal template Dataflow graph: StaticMeshImport (pattern from UV1) → sim/render split → Remesh →
      TransferSkinWeights (inpaint) → cloth config → terminal, with LODs;
    - write a Blender drape script;
    - pick fabric sets onto the PBR shelf.
  - **A. Pattern:** `garment.py pattern <cast> <design>` (exists).
  - **B. Drape** (automatic, minutes): Blender headless, with unwelded panels, sewing springs from `.seams.json`, the
    MHR body as collider, ramped shrink and sewing force, weld after. Later, a Newton port of GarmentCode's XPBD
    additions working directly on the box mesh.
  - **C. Finish** (scripted, then a human look): UV0 packed and UV1 in cm, 2–4 mm solidify on the render mesh, stitch
    lines baked from seam edges into a normal mask, a covered-body mask, optional buttons.
  - **D. Into Unreal** (scripted through UnrealClaude): import the static mesh, instance the template graph, assign the
    fabric material instance, put it on the character's Chaos Cloth Component (loose garments) or skin it (tight ones).
  - **E. Check** (human, 10–30 min): walk the shot in the desk or Play; look at the armpits, crotch and hems.
- **Manual work.** The first garment is days (template, scripts, the welded-import test). Each new design is a
  GarmentCode parameter file (minutes) or, for a new garment type, a new garment program (hours). Each cast-member
  variant is compute plus a check.
- **Quality ceiling.** The silhouette and fit can be as good as a made-to-measure basic garment, because the patterns
  are real tailoring and sized to each body. Simulation fidelity is GarmentCode-level or Blender-level, not Marvelous
  Designer's: MD has measured fabric presets, multi-layer and fold lines, pressure, and a decade of tuning. Surface
  richness is lower than Epic's MetaHuman outfits, which are MD/CLO garments with sculpted detail and hand skinning. For
  a first-person horror game seen at conversation distance, with careful fabric materials (sheen, normal weave, stitch
  lines) and live cloth on loose pieces, this should read as "good game clothing". It won't read as hero-cinematic
  couture.
- **What to buy if the user wants better.** Marvelous Designer Personal ($280/year, Windows/macOS only) used just for
  hero garments: bring GarmentCode's pattern in, add closures, pleats and layers, export USD to the same Dataflow
  template. PyGarment writes the pattern as JSON, SVG, PNG and PDF but no DXF (checked in its `wrappers.py`), so getting
  it into Marvelous Designer needs a small JSON-to-DXF-AAMA converter, or importing the placed panel OBJ. On Linux it means the $2,300/year Enterprise tier or a Windows box. Since 5.8 round-trips with MD,
  the Unreal side stays the same.
- **Risks to test first, in this order:**
  1. The welded static mesh with pattern UVs into Chaos (does sewing come through?).
  2. Outfit Asset sizing on MHR bodies (if not MetaHumans).
  3. Alembic import on the Linux 5.8.3 editor.
  4. Blender drape quality and time on a skirt (self-collision).

### Gaps
- No side-by-side quality comparison of GarmentCode drapes against Marvelous Designer drapes was found. The quality
  judgement above is inference.
- No hard numbers were found for per-garment authoring time in Marvelous Designer or for Epic's MetaHuman outfit
  authoring. The time estimates above are estimates.
- PyGarment has no DXF export (its pattern wrapper saves JSON, SVG, PNG, PDF —
  [wrappers.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/pygarment/pattern/wrappers.py)). Whether
  Marvelous Designer accepts an OBJ of flat panels as a pattern, or what a converter would take, was not checked.
