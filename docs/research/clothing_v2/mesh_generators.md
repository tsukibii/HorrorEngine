# Mesh generators: an accessory or a garment as a 3D mesh straight from an image or text (2024 to 2026)

Research date 2026-11-11. Wrapped up early on a change of weight: the user wants ready-made garments fitted to their
bodies, not generated clothing. So this note is background for the report, except for two parts that still matter:
**accessories no clothing library covers well** (bags, scarves, hats, belts, jewellery) and **the free clean-up
tools**. It holds only what was verified before stopping; what wasn't is marked "unverified".

How it was read: about 85 repositories shallow-cloned without checkout and read at source (every LICENSE quoted was read
in full in the repo; READMEs, requirements, and code where a claim depended on it). Rows give the commit date read. For
24 repositories every code-sized file was also searched for another licence's text than the repo's own. GitHub issues
were read on github.com.

Network note: **arxiv.org, \*.github.io project pages and huggingface.co were unreachable.** Paper claims, venues and
model-card licences come from search summaries and are marked "(via search)"; a weights licence stated only on a model
card is "unverified". **Nothing was run** (no graphics card here): every VRAM and time figure is the authors' or a named
user's report, never mine.

## 1. The generators that were verified, ranked for this studio

### Takeaway

One open model is worth setting up: **TRELLIS.2** (Microsoft, December 2025, MIT for code and weights, PBR maps, 24 GB).
As shipped its textured export calls a non-commercial NVIDIA library, a small thing to replace. **Stable Fast 3D and
SPAR3D** are usable today within Stability's revenue cap. **Tencent's Hunyuan3D** has the most complete pipeline and is
ruled out by its licence: outputs may not be used or distributed in the EU, the UK or South Korea. Three traps recur:
that territory clause, non-commercial libraries in the export path, and repos that are MIT or Apache on top with
Tencent-licensed files in their core.

### Cited Findings

Ranked by fitness for making accessories for a game that is sold, on one RTX 3090.

| # | Model | Released | Code licence | Weights licence, clauses | VRAM, against 24 GB | What comes out | Sold game? |
|---|---|---|---|---|---|---|---|
| 1 | **TRELLIS.2** (Microsoft, 2025-12) [repo](https://github.com/microsoft/TRELLIS.2), 2026-06-05 | code, weights (4B), training code | MIT | MIT ("This model and code are released under the MIT License"); no clause on outputs | authors: "at least 24GB"; a user on a 23 GB card: out of memory by default, peak "from about 21 GB to about 11 GB" after freeing tensors: fits with that fix | open or closed surfaces; 100k to 1M triangles (demo default 500k); automatic UV charts; base colour with alpha, metallic, roughness at 1,024 to 4,096 px; **no normal map** | **yes, after replacing nvdiffrast in the export** (non-commercial, see below) |
| 2 | **Pixal3D** (Tencent ARC, SIGGRAPH 2026) [repo](https://github.com/TencentARC/Pixal3D), 2026-09-01 | code, weights, training code | MIT | MIT ("code, parameters, weights ... in accordance with the MIT License"); none | not stated; a low-VRAM mode at 1024 | on TRELLIS.2's backbone: "PBR textures"; one image or several views | yes, same condition (its export path was not read: unverified) |
| 3 | **Stable Fast 3D** (Stability, 2024) [repo](https://github.com/Stability-AI/stable-fast-3d), 2025-01-22 | code, weights | Stability AI Community License | the same: free under **US$1M yearly revenue**, commercial users **must register**, "You own any outputs" | "about 6GB": fits | a mesh with UVs, a delit colour map (1,024 px default) and material values; remesh to triangles or quads; a vertex budget | **yes, within those strings** |
| 4 | **SPAR3D** (Stability, 2025) [repo](https://github.com/Stability-AI/stable-point-aware-3d), 2025-05-05 | code, weights | as above | as above | "10.5GB", low-VRAM "roughly 7GB": fits | as Stable Fast 3D | yes, within those strings |
| 5 | **TRELLIS** v1 (Microsoft, 2024) [repo](https://github.com/microsoft/TRELLIS), 2026-10-27 | code, weights (image and text models) | MIT ("models and the majority of the code") | MIT; none | "at least 16GB": fits | a closed mesh (also Gaussians); colour baked from the Gaussians, 1,024 px in the example; no material maps | yes, after replacing two non-commercial rasterisers in its export |
| 6 | **Direct3D-S2** (DreamTech, 2025) [repo](https://github.com/DreamTechAI/Direct3D-S2), 2025-09-26 | code, weights | MIT | card unverified | "512 ... at least 10GB", "1024 ... around 24GB": tight | shape only, closed, no UVs, no texture | yes for the shape (weights' licence unverified) |
| 7 | **Hi3DGen / Stable3DGen** (2025) [repo](https://github.com/Stable-X/Hi3DGen), 2025-07-02 | code, weights | MIT | MIT ("model and code"); NVIDIA libraries removed "to ensure this adapted version can be used commercially" | not stated | shape only | yes for the shape |
| 8 | **Hi3D v1.0** (2026-10, on Sparc3D) [repo](https://github.com/hi3d-official/Hi3Dv1.0), 2026-10-24 | code, weights | Hi3D Open License 1.0 | the same: "Commercial use is permitted"; a separate licence above 200,000 monthly users or US$1M monthly revenue; "we claim no ownership of Outputs" | measured only on 96 GB: unknown | refines a coarse mesh's geometry; no texture | yes by licence; unproven on 24 GB |
| 9 | **SAM 3D Objects** (Meta, 2025-11) [repo](https://github.com/facebookresearch/sam-3d-objects), 2026-06-02 | code, gated weights | SAM License | SAM License: no non-commercial clause; no use for ITAR activities, military, "the development or use of guns or illegal weapons" | "at least 32 Gb": **does not fit** by the authors' figure | one masked object out of a real photo: a Gaussian splat and a mesh (vertex colours by default) | yes by licence; too big |
| 10 | **TripoSG** (VAST, 2025) [repo](https://github.com/VAST-AI-Research/TripoSG), 2025-04-18 | code, weights | MIT on top; **Tencent-licensed code inside** | card unverified | "at least 8GB": fits | shape only, closed | **unclear** (see below) |
| 11 | **Hunyuan3D 2.1** (Tencent, 2025-06) [repo](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1), 2025-10-17 | code, weights, training code | Tencent Hunyuan 3D 2.1 Community License | the same: **outputs not outside the Territory (no EU, UK, South Korea)**; a licence from Tencent above 1M monthly users; "Tencent claims no rights in Outputs" | 10 GB shape, 21 GB texture, 29 GB together: fits only staged | a closed mesh at 40,000 faces by default, xatlas UVs, PBR albedo and metallic-roughness at 4,096 px | **no**, for a game sold worldwide |
| 12 | Hunyuan3D 2.0, 2mini, 2mv, Omni [repo](https://github.com/Tencent-Hunyuan/Hunyuan3D-2), 2025-10-28 | code, weights | the same family | the same clauses | 2.0: 6 GB shape, 16 GB with texture; Omni: 10 GB | 2.0: closed mesh, colour map; 2mv takes several views | no, same clause |
| 13 | **Step1X-3D** (StepFun, 2025) [repo](https://github.com/stepfun-ai/Step1X-3D), 2025-09-09 | code, weights, training code | Apache-2.0 on top; Tencent-headed files inside; nvdiffrast | Apache-2.0 per its README | 27 to 29 GB: **does not fit** | closed mesh, colour texture | unclear, and too big |
| 14 | InstantMesh (2024) [repo](https://github.com/TencentARC/InstantMesh), 2025-01-03 | code, weights | Apache-2.0; needs nvdiffrast | card unverified | not stated | closed mesh, vertex colours by default | after replacing nvdiffrast; older quality |
| 15 | CraftsMan3D [repo](https://github.com/wyysf-98/CraftsMan), 2025-06-26 | code, weights | "MIT" in the README, no licence file; a Tencent-headed file inside | card unverified | not stated | shape only | unclear |
| 16 | Unique3D (2024) [repo](https://github.com/AiuniAI/Unique3D), 2025-07-17 | code, weights | MIT; needs nvdiffrast | card unverified | not stated | textured mesh | after replacing nvdiffrast; older |
| 17 | Cube 3D and CubePart (Roblox) [repo](https://github.com/Roblox/cube), 2026-05-27 | code, weights | "CUBE3D RESEARCH-ONLY RAIL-MS LICENSE": "for academic or research purposes only" | the same | 16 to 24 GB | text to shape; parts by name | **no** |
| 18 | UltraShape 1.0 [repo](https://github.com/PKU-YuanGroup/UltraShape-1.0), 2026-01-06; Hunyuan3D-1 [repo](https://github.com/Tencent-Hunyuan/Hunyuan3D-1) | code, weights | Tencent's 2.1 licence; Hunyuan3D-1: "NON-COMMERCIAL LICENSE" | the same | not stated | geometry refinement; an older generator | no |

Not released, so not ranked: Hunyuan3D 2.5, 3.0 and 3.1 (hosted only: Tencent's organisation lists no such repo —
[Tencent-Hunyuan repositories](https://github.com/orgs/Tencent-Hunyuan/repositories?type=all&q=3D)); Hunyuan3D-Buffalo1.0
(a paper and a page — [repo](https://github.com/Tencent-Hunyuan/Hunyuan3D-Buffalo1.0)); TripoSF's generator (only its
VAE is out — [repo](https://github.com/VAST-AI-Research/TripoSF)); TripoSplat (MIT, but Gaussians, not a mesh —
[repo](https://github.com/VAST-AI-Research/TripoSplat)).

Where each cell comes from: the READMEs and licence files of the linked repos; in particular
[TRELLIS.2 README](https://github.com/microsoft/TRELLIS.2/blob/HEAD/README.md),
[Pixal3D NOTICE](https://github.com/TencentARC/Pixal3D/blob/HEAD/NOTICE),
[Stability licence](https://github.com/Stability-AI/stable-fast-3d/blob/HEAD/LICENSE.md),
[Hi3DGen README](https://github.com/Stable-X/Hi3DGen/blob/HEAD/README.md),
[Hi3D LICENSE](https://github.com/hi3d-official/Hi3Dv1.0/blob/HEAD/LICENSE),
[SAM License](https://github.com/facebookresearch/sam-3d-objects/blob/HEAD/LICENSE) and
[setup](https://github.com/facebookresearch/sam-3d-objects/blob/HEAD/doc/setup.md),
[Hunyuan3D-2.1 LICENSE](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/LICENSE) and
[README](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/README.md),
[Step1X-3D README](https://github.com/stepfun-ai/Step1X-3D/blob/HEAD/README.md),
[Cube LICENSE](https://github.com/Roblox/cube/blob/HEAD/LICENSE) and [README](https://github.com/Roblox/cube/blob/HEAD/README.md);
the READMEs of [SPAR3D](https://github.com/Stability-AI/stable-point-aware-3d/blob/HEAD/README.md),
[Stable Fast 3D](https://github.com/Stability-AI/stable-fast-3d/blob/HEAD/README.md),
[TRELLIS](https://github.com/microsoft/TRELLIS/blob/HEAD/README.md),
[Direct3D-S2](https://github.com/DreamTechAI/Direct3D-S2/blob/HEAD/README.md),
[Hi3D v1.0](https://github.com/hi3d-official/Hi3Dv1.0/blob/HEAD/README.md),
[TripoSG](https://github.com/VAST-AI-Research/TripoSG/blob/HEAD/README.md),
[Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/HEAD/README.md),
[Hunyuan3D-Omni](https://github.com/Tencent-Hunyuan/Hunyuan3D-Omni/blob/HEAD/README.md) (its
[licence](https://github.com/Tencent-Hunyuan/Hunyuan3D-Omni/blob/HEAD/License.txt)),
[InstantMesh](https://github.com/TencentARC/InstantMesh/blob/HEAD/README.md),
[CraftsMan3D](https://github.com/wyysf-98/CraftsMan/blob/HEAD/README.md); the licence files of
[Unique3D](https://github.com/AiuniAI/Unique3D/blob/HEAD/LICENSE),
[UltraShape](https://github.com/PKU-YuanGroup/UltraShape-1.0/blob/HEAD/LICENSE) and
[Hunyuan3D-1](https://github.com/Tencent-Hunyuan/Hunyuan3D-1/blob/HEAD/LICENSE.txt); "needs nvdiffrast" from each
repo's `requirements.txt` or `setup.sh`.

The clauses that decide:

- Tencent: "You must not use, reproduce, modify, distribute, or display the Tencent Hunyuan 3D 2.1 Works, Output or
  results of the Tencent Hunyuan 3D 2.1 Works outside the Territory", the Territory being "the worldwide territory,
  excluding the territory of the European Union, United Kingdom and South Korea"; its use policy also forbids placing
  generated content "in any public context ... without expressly and conspicuously identifying that the information
  and/or content is machine generated" — [Hunyuan3D-2.1 LICENSE](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/LICENSE)
- Stability: "If You are using or distributing the Stability AI Materials for a Commercial Purpose, You must register
  with Stability AI"; above US$1,000,000 yearly revenue "any licenses granted to You under this Agreement shall
  terminate"; "As between You and Stability AI, You own any outputs generated from the Models" —
  [stable-fast-3d LICENSE.md](https://github.com/Stability-AI/stable-fast-3d/blob/HEAD/LICENSE.md)
- nvdiffrast "only may be used or intended for use non-commercially ... for research or evaluation purposes only and
  not for any direct or indirect monetary gain" — [nvdiffrast LICENSE.txt](https://github.com/NVlabs/nvdiffrast/blob/HEAD/LICENSE.txt)
  (2025-12-05). TRELLIS.2's textured export imports it and rasterises the UV layout with it —
  [o_voxel/postprocess.py](https://github.com/microsoft/TRELLIS.2/blob/HEAD/o-voxel/o_voxel/postprocess.py)
- TRELLIS.2's licensing issue, open since 2025-12-18: the maintainer says nvdiffrast and nvdiffrec "are used only for
  visualization. If you only need the 3D model, you can safely omit them", "You may also choose any background removal
  model"; users answered that `to_glb()` "appears to use nvdiffrast" for baked textures and suggested Meta's DRTK; a
  team planning a commercial game asked again on 2026-11-01; no reply —
  [TRELLIS.2 issue 22](https://github.com/microsoft/TRELLIS.2/issues/22). DRTK is MIT —
  [DRTK LICENSE](https://github.com/facebookresearch/DRTK/blob/HEAD/LICENSE). The repo's background remover defaults to
  BiRefNet, MIT — [BiRefNet.py](https://github.com/microsoft/TRELLIS.2/blob/HEAD/trellis2/pipelines/rembg/BiRefNet.py),
  [BiRefNet LICENSE](https://github.com/ZhengPeng7/BiRefNet/blob/HEAD/LICENSE). DINOv3, which TRELLIS.2 requires, has
  Meta's licence with no non-commercial clause — [DINOv3 LICENSE.md](https://github.com/facebookresearch/dinov3/blob/HEAD/LICENSE.md)
- TRELLIS v1's export depends on a renderer derived from Inria's ("THE USER CANNOT USE, EXPLOIT OR DISTRIBUTE THE
  SOFTWARE FOR COMMERCIAL PURPOSES") and on nvdiffrast; a fork that swapped in gsplat and PyTorch3D is "ARCHIVED
  (November 2025)" — [TRELLIS README](https://github.com/microsoft/TRELLIS/blob/HEAD/README.md),
  [diff-gaussian-rasterization LICENSE](https://github.com/graphdeco-inria/diff-gaussian-rasterization/blob/HEAD/LICENSE.md),
  [trellis-refactored](https://github.com/kg-git-dev/trellis-refactored/blob/HEAD/README.md)
- "Permissive on top, Tencent inside": TripoSG ships the Tencent FlashVDM licence as
  [`triposg/LICENSE`](https://github.com/VAST-AI-Research/TripoSG/blob/HEAD/triposg/LICENSE) and heads its
  [transformer](https://github.com/VAST-AI-Research/TripoSG/blob/HEAD/triposg/models/transformers/triposg_transformer.py)
  "This code is based on Tencent HunyuanDiT ... Portions of this code are copied or adapted from HunyuanDiT", whose
  licence "DOES NOT APPLY IN THE EUROPEAN UNION" and restricts "Output or results" the same way —
  [HunyuanDiT LICENSE.txt](https://github.com/Tencent/HunyuanDiT/blob/HEAD/LICENSE.txt). Step1X-3D's texture baker and
  [volume decoder](https://github.com/stepfun-ai/Step1X-3D/blob/HEAD/step1x3d_geometry/models/autoencoders/volume_decoders.py)
  and CraftsMan3D's [volume decoder](https://github.com/wyysf-98/CraftsMan/blob/HEAD/craftsman/models/autoencoders/volume_decoders.py)
  carry Tencent's Hunyuan 3D licence header. The same search found nothing foreign in TRELLIS.2, Pixal3D, Direct3D-S2
  or Hi3DGen.

TRELLIS.2, read closely:

- "tested only on Linux"; CUDA Toolkit "Recommended version is 12.4"; "Conda is recommended"; PyTorch 2.6.0; compiled
  at install: flash-attn, nvdiffrast, nvdiffrec, CuMesh, o-voxel, FlexGEMM. Times on an H100: about 3 s at 512³, 17 s
  at 1024³, 60 s at 1536³ — [README](https://github.com/microsoft/TRELLIS.2/blob/HEAD/README.md)
- Its representation handles "Open Surfaces (e.g., clothing, leaves)", "Non-manifold Geometry", "Internal Enclosed
  Structures" — [README](https://github.com/microsoft/TRELLIS.2/blob/HEAD/README.md)
- The export has two branches: `remesh=False` (the function's default) keeps the generated surface, simplifies and
  repairs it, fills holes with a rim under `3e-2` of the unit box and writes a double-sided material; `remesh=True` (the
  README's example and the demo) rebuilds it by narrow-band dual contouring into a closed shell —
  [postprocess.py](https://github.com/microsoft/TRELLIS.2/blob/HEAD/o-voxel/o_voxel/postprocess.py),
  [app.py](https://github.com/microsoft/TRELLIS.2/blob/HEAD/app.py)
- Users on dressed figures: "inner hulls are common and a major issue"; with `remesh=False` "the parallel shells are not
  generated, but the mesh looks dirty" — [TRELLIS.2 issue 25](https://github.com/microsoft/TRELLIS.2/issues/25). In
  ComfyUI its meshes are "hollow and not watertight", where Hunyuan3D's print —
  [ComfyUI issue 16147](https://github.com/Comfy-Org/ComfyUI/issues/16147)
- Memory: the 23 GB report and its fix, and a 16 GB card completing 1536³ with the decoder run in tiles (peak 11.4 GB),
  are in [TRELLIS.2 issue 188](https://github.com/microsoft/TRELLIS.2/issues/188). A user says it "works on my 3090"
  through ComfyUI (via search) — [Reddit snapshot](https://reddit.sentinel-team.org/posts/1pqxkag/snapshots/2025-12-20T08%3A31%3A16.315468Z)
- From text, Microsoft's own advice for v1: "first generating images using text-to-image models and then using
  TRELLIS-image models" — [TRELLIS README](https://github.com/microsoft/TRELLIS/blob/HEAD/README.md)

Hunyuan3D-2.1's settings, for comparison: texture 4,096 px baked from 6 to 9 views rendered at 2,048 px; 40,000 faces by
default — [textureGenPipeline.py](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/hy3dpaint/textureGenPipeline.py),
[postprocessors.py](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/hy3dshape/hy3dshape/postprocessors.py).
A third party measured its texture model at about 18.8 GB (via search) —
[DebuggerCafe](https://debuggercafe.com/image-to-3d-incremental-optimizations-for-vram-multi-mesh-output-and-ui-improvements/)

### Inferences

- The change that makes TRELLIS.2 clean is small and local: the export uses nvdiffrast for two calls (rasterise the
  triangles in UV space, interpolate positions); nvdiffrec is only the preview renderer. My estimate: a few dozen lines
  with DRTK or PyTorch3D. Until then a textured GLB from the shipped code has passed through a research-only library.
- On the 3090: the 512 or 1024 setting with the tensor-freeing fix. Install on Arch means a CUDA 12.4 toolkit beside
  the system's and five packages built from source; it runs from a Python script, so it can sit behind our own page.
- Read strictly, TripoSG's outputs (and those of HoloPart and PartCrafter, built on it) inherit HunyuanDiT's EU
  exclusion; read loosely, borrowed architecture code is not the model. A lawyer's question; not worth asking while
  clean alternatives exist.
- MIT and Apache-2.0 weights put no term on the output. In the US and the EU a purely generated mesh likely has no
  copyright at all (§5): the studio may ship it but can't count it as "ours" the way its rule means.

### Gaps

- Unverified: the weights' licences that live only on Hugging Face cards (Direct3D-S2, TripoSG, InstantMesh, Unique3D,
  CraftsMan3D); Pixal3D's export code and VRAM; whether SAM 3D Objects or Hi3D v1.0 run in 24 GB.
- Unverified: a user's remark in issue 22 that TRELLIS.2's project page calls the materials "solely for academic and
  research purposes" (the page could not be opened; repo and README say MIT).
- No time or quality was measured on a 3090 for any of them.

## 2. Accessories from a reference image, and the clean-up each needs

### Takeaway

This is what the generators are for: a bag, a hat or a pendant is an ordinary object, and one picture gives a textured
mesh in a minute or so. What comes out is never game-ready: hundreds of thousands of triangles, small automatic UV
charts, sometimes an inner hull, no scale, no bone. A rigid accessory needs decimation and a bone; a soft one (a scarf)
needs fitting to the body and the body's weights, and stays as stiff as it was generated.

### Cited Findings

- Output of the candidate (TRELLIS.2): 100k to 1M triangles at export, automatic charts, colour, metallic and roughness
  maps, no normal map — [postprocess.py](https://github.com/microsoft/TRELLIS.2/blob/HEAD/o-voxel/o_voxel/postprocess.py),
  [app.py](https://github.com/microsoft/TRELLIS.2/blob/HEAD/app.py)
- Budgets others settle on: Hunyuan3D reduces to 40,000 faces by default; a community game-asset pipeline of November
  2026 decimates "to a production-ready 56,000 face budget" and re-unwraps with xatlas —
  [postprocessors.py](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/hy3dshape/hy3dshape/postprocessors.py),
  [espalier README](https://github.com/overyonder/espalier/blob/HEAD/README.md)
- Accessories are in these models' range: Hi3D's own comparisons include a handbag —
  [Hi3D v1.0 README](https://github.com/hi3d-official/Hi3Dv1.0/blob/HEAD/README.md)
- Thin, open things are the weak spot of every model but TRELLIS.2: "General-purpose 3D models (Trellis, Hunyuan3D 2.1)
  are limited to closed (watertight) surfaces" and produce "thin double-layer shells" for open ones; TRELLIS.2 is marked
  as supporting open and hybrid surfaces (via search) — [arXiv 2605.26149](https://arxiv.org/pdf/2605.26149)
- Flat pictures fail: for flat-coloured illustrations the models output "abnormal thin structures", for want of
  "shadows, certain viewpoints, and reasonable depth structures" (via search) — [Art3D](https://arxiv.org/html/2504.10466v1)
- The Character Studio already places accessories by hand ("Placement: x, y, z and three turns"), holds small ones to
  "the skin's triangle there", makes hats and necklaces in code, and gives worn meshes "four bones and their weights
  from the skin round it" — project files `CLAUDE.md` (tools/character) and `docs/TAILOR.md` §3b

### Inferences

The route (a proposal, not built): the user's own photo or drawing of the thing, three-quarter view with shading, into
TRELLIS.2; pick the best of a few seeds; Blender headless: drop loose inner faces, decimate, re-bake the maps onto fresh
UVs if the charts are too fragmented, set scale in metres and a pivot; into the Studio's Accessories tab.

| Accessory | What the generator gives | Clean-up | On the character | My estimate by hand |
|---|---|---|---|---|
| Bag (hand, shoulder, backpack) | a closed solid; straps may fuse or break | decimate to 10k to 30k triangles; check the strap; re-bake | rigid on one bone (hand, clavicle, spine); a strap across the chest takes the body's weights | 20 to 60 minutes |
| Hat | a closed solid; a head inside it if pictured worn | remove the head; keep the brim's underside; decimate | rigid on the head bone, scaled to the head; clashes with hair as the Studio's own hats do | 20 to 40 minutes |
| Jewellery (pendant, brooch, charm, ring) | fine detail is at the limit of the voxel grid | decimate hard (1k to 3k); use a metal from our shelf rather than the generated colour | rigid, held to the skin's triangle or hung on the Studio's own chains | 15 to 30 minutes |
| Belt | a ring of some arbitrary girth | only the buckle is worth generating; the strap is better lifted off the body by the tailor, which fits every waist | buckle rigid on the pelvis | 15 to 30 minutes for a buckle |
| Scarf, shawl | worn: a shell round an invented neck; alone: a draped lump | remove the neck and inner hull, clean the rims, fit round the MHR neck, push out of the skin | the body's weights (neck, upper spine, clavicles); hanging ends don't swing | one to two hours, and it fits one body |
| Shoe | a closed solid | decimate; flatten the sole to the floor | rigid on the foot bone: no bend at the toes | 20 to 40 minutes; the tailor's shoes bend |

- Normal maps: none comes out. At 1 to 2 m under the VHS filter that matters little for a bag; stitches and grain can
  come from a PBR shelf set laid over the generated colour.
- The reference picture has to be the user's own. A shop's photo is the shop's; a recognisable designer bag is a design
  and trademark problem whatever the model's licence (the Cloth2Tex note's rule).
- Steam's form counts such assets as "pre-generated" AI content that players see (§5): the user's call.

### Gaps

- All times are my estimates; no source measures clean-up per asset. A trial on five accessories would replace them.
- Whether TRELLIS.2 keeps straps, buckles and chains intact at 1024 on a 3090: untested.
- Which text-to-image model could make the reference picture under a clean licence: not in this slice.

## 3. The free clean-up tools and their licences

### Takeaway

Retopology and UVs are covered by tools that leave no licence on the result. The learned retopologiser people cite
(MeshAnything V2) is non-commercial and stops at 1,600 faces. Auto-riggers exist under MIT and Apache, but they invent
their own skeleton, which a studio on MHR's has no use for: a rigid accessory needs one bone, and a worn piece takes the
body's weights, which the tailor already computes.

### Cited Findings

| Job | Tool | Repo, last commit | Licence | Notes |
|---|---|---|---|---|
| Retopology | Blender's Decimate and Quad remesh | built in | GPL tool | from memory: Blender's docs were unreachable (unverified here) |
| | Instant Meshes | [wjakob/instant-meshes](https://github.com/wjakob/instant-meshes/blob/HEAD/LICENSE.txt), 2019-11-03 | BSD 3-clause | Stability's pipeline uses it for its quad option |
| | QuadriFlow | [hjwdzh/QuadriFlow](https://github.com/hjwdzh/QuadriFlow/blob/HEAD/README.md), 2019-12-07 | "MIT License"; bundled solvers LGPL unless built with `BUILD_FREE_LICENSE` | |
| | QRemeshify | [ksami/QRemeshify](https://github.com/ksami/QRemeshify/blob/HEAD/README.md), 2024-10-08 | GPL-3.0 (a tool) | Blender 4.2 and above; "Slower for more complex shapes eg. lots of cloth folds"; "decimate to <100k tris would be a good start" |
| | MeshAnything V2 | [buaacyw/MeshAnythingV2](https://github.com/buaacyw/MeshAnythingV2/blob/HEAD/LICENSE.txt), 2025-04-29 | **S-Lab License: "for non-commercial purpose"** | "cannot generate meshes with more than 1600 faces"; about 8 GB and 45 s on an A6000 |
| | DeepMesh | [zhaorw02/DeepMesh](https://github.com/zhaorw02/DeepMesh/blob/HEAD/README.md), 2025-12-17 | licence file Apache-2.0, README badge MIT | 0.5B weights out, the 1B model not; meshes a point cloud; weights' card unverified |
| UVs | xatlas | [jpcy/xatlas](https://github.com/jpcy/xatlas/blob/HEAD/LICENSE), 2022-07-26 | MIT | the unwrapper inside Hunyuan3D's, InstantMesh's and TRELLIS v1's setups |
| | CuMesh (TRELLIS.2's own, on CUDA) | [JeffreyXiang/CuMesh](https://github.com/JeffreyXiang/CuMesh/blob/HEAD/LICENSE), 2026-05-09 | MIT | simplify, repair, unwrap |
| | Blender's Smart UV Project | built in | GPL tool | from memory (unverified here) |
| | PartUV | [EricWang12/PartUV](https://github.com/EricWang12/PartUV/blob/HEAD/LICENSE), 2026-07-18 | Apache-2.0 plus a "Third-Party License: NVIDIA License (non-commercial research and educational purposes only)" | needs PartField's checkpoint; its part packing uses a paid add-on |
| Weights from the body | the tailor's `weights.js` | ours | ours | already does it for every garment |
| | Robust skin weights transfer | [rin-23/RobustSkinWeightsTransferCode](https://github.com/rin-23/RobustSkinWeightsTransferCode), 2024-07-24; add-on [sentfromspacevr/robust-weight-transfer](https://github.com/sentfromspacevr/robust-weight-transfer), 2026-03-27 | MIT sample code; GPL-3.0 add-on | weights from a body "without needing additional weight painting work ... (between legs, between chest, armpits)" |
| Auto-rigging | SkinTokens / TokenRig (2026) | [VAST-AI-Research/SkinTokens](https://github.com/VAST-AI-Research/SkinTokens/blob/HEAD/README.md), 2026-05-12 | MIT | "at least 14 GB"; installs with `uv venv --python 3.11`; `--use_skeleton`: "Use existing skeleton (generate skin only)" |
| | UniRig (SIGGRAPH 2025) | [VAST-AI-Research/UniRig](https://github.com/VAST-AI-Research/UniRig/blob/HEAD/README.md), 2026-06-04 | MIT | skeleton and weights; the paper's main checkpoint still "Planned" |
| | Puppeteer; MagicArticulate | [Seed3D/Puppeteer](https://github.com/Seed3D/Puppeteer), 2025-09-19; [Seed3D/MagicArticulate](https://github.com/Seed3D/MagicArticulate), 2025-09-14 | Apache-2.0 | Puppeteer: skeleton, weights, animation; MagicArticulate: skeleton weights only |
| | Make-It-Animatable | [jasongzy/Make-It-Animatable](https://github.com/jasongzy/Make-It-Animatable), 2026-09-08 | MIT | humanoids on Mixamo's bones |
| | AniGen (SIGGRAPH 2026) | [VAST-AI-Research/AniGen](https://github.com/VAST-AI-Research/AniGen/blob/HEAD/README.md), 2026-07-15 | MIT, but a bundled BVH "licensed for non-commercial / research use only" | image to rigged mesh; "at least 18GB", verified on an RTX 3090 |
| | RigAnything | [Isabella98Liu/RigAnything](https://github.com/Isabella98Liu/RigAnything/blob/HEAD/LICENSE.md), 2025-10-23 | **Adobe Research License: "noncommercial research purposes ... only"** | blocked |
| Cutting a mesh into parts | GeoSAM2 (CVPR 2026) | [VAST-AI-Research/GeoSAM2](https://github.com/VAST-AI-Research/GeoSAM2/blob/HEAD/README.md), 2026-05-07 | Apache-2.0 | a 2D mask on one of 12 Blender renders becomes per-face labels; weights' card unverified |
| | SAMPart3D | [Pointcept/SAMPart3D](https://github.com/Pointcept/SAMPart3D), 2025-05-04 | MIT | part segmentation at several granularities |
| | HoloPart, PartCrafter | [HoloPart](https://github.com/VAST-AI-Research/HoloPart), 2025-04-11; [PartCrafter](https://github.com/wgsxm/PartCrafter), 2026-04-17 | MIT on top; the HunyuanDiT-derived transformer inside | HoloPart completes a marked part into a whole one; PartCrafter needs "at least 8GB" |
| | PartField, PartPacker, OmniPart, P3-SAM and X-Part, CubePart | [PartField](https://github.com/nv-tlabs/PartField/blob/HEAD/LICENSE), [PartPacker](https://github.com/NVlabs/PartPacker/blob/HEAD/license.md), [OmniPart](https://github.com/HKU-MMLab/OmniPart/blob/HEAD/NOTICE), [Hunyuan3D-Part](https://github.com/Tencent-Hunyuan/Hunyuan3D-Part), [CubePart](https://github.com/Roblox/cube/tree/HEAD/cubepart) | NVIDIA non-commercial (the first two, and code derived from PartField inside OmniPart); Tencent's territory clause; research-only | blocked |

- Stability's remesh options name their sources: triangles "from A Remeshing Approach to Multiresolution Modeling by M.
  Botsch and L. Kobbelt", quads "from Instant Field-Aligned Meshes"; "CPU overhead expected" —
  [Stable Fast 3D README](https://github.com/Stability-AI/stable-fast-3d/blob/HEAD/README.md)
- P3-SAM also needs Sonata, whose "weight is released under the CC-BY-NC 4.0 license" —
  [sonata README](https://github.com/facebookresearch/sonata/blob/HEAD/README.md)
- HoloPart's and PartCrafter's transformer files carry TripoSG's header ("based on Tencent HunyuanDiT ... licensed under
  the Tencent Hunyuan Community License Agreement") —
  [HoloPart](https://github.com/VAST-AI-Research/HoloPart/blob/HEAD/holopart/models/transformers/triposg_transformer.py),
  [PartCrafter](https://github.com/wgsxm/PartCrafter/blob/HEAD/src/models/transformers/partcrafter_transformer.py)
- OmniPart's notice: "code derived from PartField ... available under the NVIDIA Source Code License", and RMBG-2.0 —
  [OmniPart NOTICE](https://github.com/HKU-MMLab/OmniPart/blob/HEAD/NOTICE)

### Inferences

- For accessories the whole clean-up can be Blender headless plus xatlas: decimation, not quad retopology, is what a
  skinned or rigid game mesh needs.
- No auto-rigger is needed. SkinTokens' skin-only mode on a given skeleton is the one feature that could serve, as a
  second opinion on a scarf's weights.
- GeoSAM2 is the clean way to lift one thing off a generated figure (the bag off the shoulder): paint a mask on one
  view, keep those faces, cap the hole by hand.

### Gaps

- Unverified: Blender's own tools (from memory); whether SkinTokens accepts MHR's skeleton as is; VRAM for GeoSAM2,
  SAMPart3D and HoloPart (not stated in their READMEs).
- No evidence was found of any part tool separating clothes or accessories from a body; they were tested on objects.

## 4. Does anything here beat a library of ready-made garments for wearable clothing?

### Takeaway

**No.** Nothing verified here gives a wearable garment for an MHR body with less work, or a better result, than a
garment a person already designed. Of the 23 garment-specific methods checked, 14 have no code that could be found
(three of those are empty repositories). The nine with code are non-commercial (five) or ship no licence file (four),
and five of the nine need SMPL or SMPL-X. The general generators make an object, not a
garment on a body: no body, no scale, no panels or metre UVs, automatic charts, a body or an inner hull inside a worn
piece, and nothing that refits when the body changes. A library garment starts with clean topology, a rest pose and
designed seams, and fitting it to MHR is a deformation problem that is already half solved on a body of fixed topology.
What generation adds is only what no library has: one-off accessories (§2). The single idea worth keeping from the
garment papers is Garment3DGen's, to deform a clean garment onto a generated target shape, and a library garment makes
a better starting mesh for that than any generated one.

### Cited Findings

The garment-specific methods, as verified (the state of each, not a full record):

| Method | State at source | Why not |
|---|---|---|
| Garment3DGen (Meta, 3DV 2025 via search) | code, [2024-07-09](https://github.com/nsarafianos/Garment3DGen); deforms a base garment toward a target mesh made by InstantMesh | [CC BY-NC 4.0](https://github.com/nsarafianos/Garment3DGen/blob/HEAD/LICENSE.md); needs nvdiffrast |
| GarmentDreamer (3DV 2025) | code and weights, [2025-10-02](https://github.com/boqian-li/GarmentDreamer); text plus a template mesh | [CC BY-NC 4.0](https://github.com/boqian-li/GarmentDreamer/blob/HEAD/LICENSE); Inria's rasteriser |
| GarVerseLOD (ACM TOG 2024) | a dress demo, [2024-11-29](https://github.com/zhongjinluo/GarVerseLOD); databases "Coming soon." | no licence file; "ICON's codebase for SMPL optimization" |
| GALA (CVPR 2024) | code, [2025-03-13](https://github.com/snuvclab/GALA/blob/HEAD/README.md); input is a 3D scan | "only for non-commercial research purposes"; SMPL-X |
| SO-SMPL (ECCV 2024) | code, [2024-12-10](https://github.com/shanemankiw/SO-SMPL/blob/HEAD/README.md) | "for non-commercial use only"; SMPL-X |
| StdGEN (CVPR 2025) | code and weights, [2026-04-17](https://github.com/hyz317/StdGEN/blob/HEAD/README.md); body, clothes and hair as separate meshes, anime | "released checkpoints are also for research purposes only" |
| Gaussian Garments (3DV 2025) | code, [2025-06-16](https://github.com/eth-ait/Gaussian-Garments/blob/HEAD/README.md); input is multi-view video; UVs "have to be done manually" | no licence file; a capture stage |
| Garment Recovery (CVPR 2024), DMap (SIGGRAPH 2025) | code, [2024-08-13](https://github.com/liren2515/GarmentRecovery), [2025-09-12](https://github.com/liren2515/DMap) | no licence file; SMPL-family folders in both (`smpl_pytorch`, `smplx_econ`; `human_body_prior`), judged by folder name |
| ClotheDreamer; TELA | repos with no code: [a README and a licence](https://github.com/ggxxii/ClotheDreamer), 2024-06-25; ["Coming soon..."](https://github.com/DongJT1996/TELA), 2024-04-24 | never released |
| GarmageNet (Style3D) | [the project page's files only](https://github.com/Style3D/garmagenet), 2025-12-09 | no code |
| WordRobe, HumanCoser, DiffAvatar, DeClotH, StdGEN++, GarmentCrafter, Image2Garment, Dress-1-to-3, DiffGI, Fashion-3DLR, the Outfit3D paper | no repository found (via search; the last five are 2025 to 2026 papers) | unverified beyond "not found": a repo under another name is possible |

- Garment3DGen's own limits: "Aim for your source and target geometry to be reasonably close to each other. Going from
  a skirt to a shirt won't work well." — [Garment3DGen README](https://github.com/nsarafianos/Garment3DGen/blob/HEAD/README.md)
- What a dressed figure looks like out of the best open model: "a character wearing a t-shirt with a messy body
  structure underneath" — [TRELLIS.2 issue 25](https://github.com/microsoft/TRELLIS.2/issues/25)
- SAM 3D Body "estimates the human pose of the body, feet, and hands based on the Momentum Human Rig (MHR)": the one
  tool in this slice that speaks MHR, useful for fitting a body to a photo, not for making clothes —
  [sam-3d-body README](https://github.com/facebookresearch/sam-3d-body/blob/HEAD/README.md)

### Gaps

- Sources for the papers without a repo, all via search: [WordRobe](https://arxiv.org/abs/2403.17541),
  [HumanCoser](https://arxiv.org/pdf/2408.11357), [DiffAvatar](https://cvpr.thecvf.com/virtual/2024/poster/29902),
  [DeClotH](https://openaccess.thecvf.com/content/CVPR2025/html/Nam_DeClotH_Decomposable_3D_Cloth_and_Human_Body_Reconstruction_from_a_CVPR_2025_paper.html),
  [StdGEN++](https://arxiv.org/abs/2601.07660v1), [GarmentCrafter](https://arxiv.org/abs/2503.08678v1),
  [Image2Garment](https://arxiv.org/abs/2601.09658), [Dress-1-to-3](https://arxiv.org/abs/2502.03449),
  [DiffGI](https://arxiv.org/abs/2607.13365), [Fashion-3DLR](https://arxiv.org/pdf/2607.23189),
  [arXiv 2605.26149](https://arxiv.org/pdf/2605.26149). Their venues, bodies and release plans were not read at source.
- Whether a generated shape is a useful *target* for fitting a ready-made garment was not tested by anyone found.

## 5. Background: whose a generated mesh is

### Takeaway

No licence above claims the output; none warrants that it infringes nobody. In the United States a purely generated
mesh has no human author and so no copyright; the EU's position is the same in practice. The studio can ship such a
mesh (under the clean licences) but owns only what a person adds to it.

### Cited Findings

- US Copyright Office, Part 2 of its AI report (2025-01-29): "prompts alone do not provide sufficient human control to
  make users of an AI system the authors of the output"; a human's own work "perceptible in the output", the selection
  and arrangement of outputs and "creative modifications of the outputs" remain protectable (via search) —
  [Mintz](https://www.mintz.com/insights-center/viewpoints/54731/2025-02-07-us-copyright-office-publishes-second-part-report-ai)
- Thaler v. Perlmutter: the D.C. Circuit held in 2025 that copyright requires a human author; the Supreme Court denied
  review on 2026-03-02; no court has drawn the line for "how much human involvement is enough" (via search) —
  [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/03/supreme-court-denies-review-in-ai-authorship-case)
- EU: works generated by AI "cannot benefit from copyright protection" under the current approach. UK: section 9(3)'s
  protection for computer-generated works is still in force, and a government report of 2026-03-18 proposes removing it
  (via search) — [JD Supra](https://www.jdsupra.com/legalnews/navigating-copyright-in-the-age-of-3595867/)
- Steam: developers declare "Pre-generated" and "Live-generated" AI content; since January 2026 only content "directly
  consumed by players" counts (via search) — [GIGAZINE](https://gigazine.net/gsc_news/en/20260120-steam-updates-ai-disclosure-guidelines)
- Hosted services' free tiers carry strings: Meshy's free-plan models are "licensed under CC BY 4.0 ... as long as you
  credit Meshy" (via search) — [Meshy help](https://intercom.help/meshy/en/articles/16102098-can-i-use-meshy-assets-commercially)

### Inferences

- "CC0 or ours" needs a third word for a generated accessory: not CC0 (nobody dedicated it), likely nobody's copyright,
  shippable, and not protectable against copying except for the hand work on it.

### Gaps

- Unverified: Japan's position; Valve's current Steamworks wording at source; the Copyright Office's report and the
  court decisions were read through law firms' summaries; nothing was found on the models' training data licences.
