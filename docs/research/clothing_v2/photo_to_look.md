# Custom fabrics, re-fabricking and decals for ready-made garments, and what AI texturing offers (2024 to 2026)

Research date 2026-11-11. Slice: giving **a garment mesh that already exists, with its own UVs,** its look. The slice
started as "the niche Cloth2Tex sat in" (a look from a photo or a prompt) and was **re-weighted during the work**: the
user said they don't need procedural clothing, that ready-made garment meshes fitted to the studio's bodies are fine,
and that what they want on them is "custom PBRs, PNG decals etc". So this note leads with three questions for garments
that arrive already designed, with their own UVs and usually their own baked colour texture: (1) a tileable fabric PBR
set from a photo, (2) re-colouring or re-fabricking such a garment, (3) placing PNG decals and prints on it; and it
keeps whole-garment AI texturing to one ranked table (§4). Where the garments come from and how they are fitted is
another note's subject.

**Network note.** `git clone` and WebFetch worked for github.com only. About a hundred repositories were
shallow-cloned without checkout and their LICENSE, README and key source files read with `git show`; every fact marked
**(source)** comes from those files or from a GitHub issue page, at the HEAD of the default branch on 2026-11-11
("last commit" dates are HEAD dates). huggingface.co, arxiv.org and \*.github.io could not be opened (the proxy refused
them), so **weight licences that live only on a Hugging Face model card, and anything from a paper's text, are from
search summaries and marked (search)**; where a search gave nothing they are marked **unverified**. Nothing was
installed or run (no graphics card here): VRAM and time figures are the authors' or a user's unless marked "estimate".
Questions 2 and 3 were added late with an instruction not to open new searches: their cited findings are what the
repositories already read say; the techniques themselves are in *Inferences* and are standard practice, not findings.

**Three things cut across the whole slice** (quotes in §4 and §6):

1. **nvdiffrast is still non-commercial** (source, last commit 2025-12-05), and most AI texture bakers import it.
2. **Three licence families block a game sold worldwide**: FLUX.1-dev / FLUX.2-dev (non-commercial use of the model;
   every LoRA on them inherits it), Tencent Hunyuan 3D (outputs may not be distributed in the EU, the UK or South
   Korea), and "research only" (CHORD, RGB-X, Pix2Surf, Garment3DGen, the try-off models).
3. **"Takes your mesh" rarely means "keeps your UVs".** Hunyuan3D-Paint 2.0 and 2.1 and NI-Tex re-unwrap with xatlas
   (2.1 also remeshes by default); Dream Textures overwrites the UVs of the faces it projects on; StableGen bakes into
   a new "BakeUV" map beside the original. MV-Adapter, TRELLIS.2, SyncMVD, Paint3D, DiffusedTexture and
   StableProjectorz write into the UVs they are given.

**Ranked verdicts** (reasons and sources in the sections).

(1) A tileable fabric PBR set from a photo:

| Rank | Route | Verdict | Reason in a line |
|---|---|---|---|
| 1 | A flat swatch (own photo or scan) made tileable, then **PBRify_Remix** (CC0 weights) for normal, roughness and height; **DeepBump** (GPL-3.0 tool, CPU) as the second opinion for normal and height | usable now | licence-clean end to end, a few GB or none, loadable from Python without its app; the maps are a network's guess from colour and it does not remove baked light |
| 2 | **StableMaterials** (a text or image prompt to a new tileable basecolor, normal, height, roughness, metallic) | usable now (weight licence "openrail" via search) | makes a fabric "like" the picture, not that fabric; 512 px base |
| 3 | **FabricDiffusion**'s texture normaliser in front of 1 (a crop of a worn, wrinkled, lit garment to a flat tileable swatch) | usable with work | the only released model for exactly this; 256 px, crops picked by hand, weight licence unstated, its own PBR head never released |
| 4 | **Material Palette** (region mask to a LoRA to a texture up to 8K, then albedo, normal, roughness) | usable with work | MIT code and decomposition weights on SD 1.5; a fine-tune per material, 2023 stack |
| 5 | MatFuse | unclear | MIT tag on weights trained partly on a CC BY-NC-ND dataset; 12 GB |
| - | CHORD (Ubisoft), RGB-X (Adobe), ControlMat, DressCode's fabric generator, Hunyuan3D-Delight | not usable | research-only; research-only; no code; no licence; territory clause |

(2) Re-colouring or re-fabricking a garment that has its own baked colour texture:

| Rank | Route | Verdict | Reason in a line |
|---|---|---|---|
| 1 | **A layered rebuild in our own code**: masks from what the asset already has (UV islands, material slots, its own normal / roughness / AO maps) plus colour clustering; the old texture flattened into a greyscale detail layer; a new fabric under it, prints and trims kept by mask | usable now (to build) | deterministic, no VRAM, reuses the studio's fabric and layer code; only as clean as the source texture is free of baked light |
| 2 | **Marigold-IID-Lighting** (albedo, shading, residual) or **StableDelight** (speculars) as a de-lighting pass before 1 | usable with work | Apache-2.0 code, OpenRAIL++-M and Apache-2.0 weights; made for photos of scenes and objects, untested on a garment's UV atlas |
| 3 | **PBRify_Remix** or **DeepBump** on the old colour texture, to get the stitching's and seams' normal and roughness when the asset ships colour only | usable now | CC0 / GPL tool; reads baked shadows as relief when the texture is lit |
| 4 | **SAM 2** (Apache-2.0) for the masks the UV layout doesn't give (a print, a trim, a pocket) | usable now | clicks or boxes per garment |
| 5 | **DiffusedTexture** "texture-to-texture" or **StableGen** "Masked Edit": repaint from the existing texture by prompt | usable now | changes more than the fabric and softens fine detail (its authors); good for a variant, not for a controlled re-fabric |
| 6 | **Material Anything** (an albedo-only mesh to albedo, roughness, metallic, bump) | usable with work | MIT code, weight licence unverified, Blender 3.2.2 scripts |
| - | CHORD, Hunyuan3D-Delight, RGB-X, Intrinsic (Careaga and Aksoy) | not usable | research-only; territory; research-only; academic-only |

(3) PNG decals and prints on arbitrary garments:

| Rank | Route | Verdict | Reason in a line |
|---|---|---|---|
| 1 | **Project, clip, bake into the garment's own texture through its UVs**, in the studio's page (three.js `DecalGeometry`, MIT, for the projection; the same bake the tailor's prints use) | usable now (to build) | works on any UV layout, crosses seams correctly, costs nothing at run time, follows the skinned cloth because it is the texture |
| 2 | Keep the decal as **a thin skinned mesh patch** (the mesh `DecalGeometry` makes, weights copied from the garment) | usable now (to build) | needed when the garment's UVs overlap or mirror; one more draw and an offset to manage |
| 3 | Godot's runtime **Decal** node | not for skinned clothes | a box projection that "doesn't rely on mesh generation"; fine for props and walls, limited to 8 a mesh outside Forward+ |
| 4 | Getting the PNG: a logo cut out with **BiRefNet** or **rembg** (MIT); a print lifted off a photo of clothing with **FabricDiffusion**'s print normaliser | usable now / with work | the second is 256 px with an unstated weight licence |
| 5 | By hand in an app: **StableProjectorz** (AGPL-3.0), Blender | usable | hand tools, not scriptable |

## 1. A tileable fabric PBR set from a photo: the best free choice in 2026, and the classical fallbacks

### Takeaway

The best free, commercially clean choice is not a single model: it is a flat colour tile (photographed or scanned,
made to tile by code) run through **PBRify_Remix**, whose normal, roughness and height models are CC0 and trained on
ambientCG and Poly Haven, with **DeepBump** (GPL-3.0, command line, CPU) as the alternative. When the photo is of a
worn garment rather than a flat cloth, **FabricDiffusion**'s texture normaliser is the only released model that
flattens and de-lights the crop first. The better-known research models are either prompt tools that do not copy the
photo (StableMaterials, MatFuse), slow extractors (Material Palette) or blocked (CHORD, RGB-X, ControlMat). No source
measures any of them on cloth.

### Cited Findings

| Tool (venue) | Released, last commit | Code licence | Weights licence | In → out | VRAM, needs | Source |
|---|---|---|---|---|---|---|
| **PBRify_Remix** | three 1x models (normal V3, roughness V2, height) and 4x upscalers as `.pth`, a chaiNNer chain, a ComfyUI path; 2026-02-18 | CC0 1.0 | "These models are licensed as CC0"; "trained exclusively on high quality CC0 content from ambientCG"; "Textures were sourced from ambientCG and PolyHaven"; SPAN for the maps, DAT2 for the upscaler | "generate PBR maps from diffuse or albedo texture maps": normal, roughness, height (height off by default for "the current lack of a 'delighting' pipeline") | a "6GB_VRAM" chain is provided | [README](https://github.com/Kim2091/PBRify_Remix/blob/HEAD/README.md); [EXTRA_INFO](https://github.com/Kim2091/PBRify_Remix/blob/HEAD/EXTRA_INFO.md); [LICENSE](https://github.com/Kim2091/PBRify_Remix/blob/HEAD/LICENSE) |
| **DeepBump** | Blender add-on and CLI with its ONNX models in the repo; 2025-03-17 | GPL-3.0 | in the GPL repo | colour → normal; normal → height (`--normals_to_height-seamless TRUE`); normal → curvature; upscale | CPU: `pip install numpy onnxruntime==1.15.1 imageio`, then `python3 cli.py color.jpg normals.jpg color_to_normals` | [cli.md](https://github.com/HugoTini/DeepBump/blob/HEAD/cli.md); [LICENSE](https://github.com/HugoTini/DeepBump/blob/HEAD/LICENSE) |
| Material-Map-Generator | ESRGAN-style models in the repo; 2023-07-20 | Apache-2.0 | in the repo | diffuse → normal, displacement, roughness; `--seamless`, `--tile_size` | small | [README](https://github.com/joeyballentine/Material-Map-Generator/blob/HEAD/README.md) |
| **FabricDiffusion** (SIGGRAPH Asia 2024) | inference code only ("[Jan 2 2025] Inference code released", the last commit) and two checkpoints | "We use the X11 License. This license is identical to the MIT License, but with an extra sentence that prohibits using the copyright holders' names" (README only, no LICENSE file) | **unverified**: no licence field found on the model cards (search) | a 256 px crop of a worn garment → a flat tileable 256 px swatch (`n_samples` variants); a print crop → an RGBA print | not stated; diffusers 0.32.1, torch 2.5.1; `python inference_texture.py --texture_checkpoint ... --src_dir ... --save_dir ...` | [README](https://github.com/humansensinglab/fabric-diffusion/blob/HEAD/README.md); [pipeline.py](https://github.com/humansensinglab/fabric-diffusion/blob/HEAD/pipeline.py); [print card (search)](https://huggingface.co/Yuanhao-Harry-Wang/fabric-diffusion-print) |
| **Material Palette** (CVPR 2024) | concept learning, generation and decomposition code; decomposition weights as a GitHub release; 2025-05-19 | MIT | decomposition net in the MIT repo's release; the diffusion checkpoint "is licensed under the CreativeML Open RAIL-M license" | image + region masks → per-region LoRA ("~8Kb") → texture at 1K, 2K, 4K or 8K → albedo, normals, roughness | not stated; "tested with Python 3.10.8, PyTorch 1.13, diffusers 0.19.3, peft 0.5"; `runwayml/stable-diffusion-v1-5` "no longer available" | [README](https://github.com/astra-vision/MaterialPalette/blob/HEAD/README.md) |
| **StableMaterials** (2024) | weights and a diffusers pipeline on Hugging Face | - | "openrail" (search); tagged with the MatSynth dataset | text or image prompt → basecolor, normal, height, roughness, metallic; `tileable=True`; 512 px base with a refiner | not stated | [model card (search)](https://huggingface.co/gvecchio/StableMaterials); [paper (search)](https://arxiv.org/abs/2406.09293) |
| MatFuse (CVPR 2024) | code, weights, a diffusers `MatFusePipeline`; 2026-02-19 | MIT | MIT (search); "trained on a combination of the dataset by Deschaintre et al. (2018) and materials from the PolyHeaven library" | text, picture, sketch or palette → diffuse, normal, roughness, specular | "at least 12GB of GPU VRAM" | [README](https://github.com/giuvecchio/matfuse-sd/blob/HEAD/README.md); [weights (search)](https://huggingface.co/gvecchio/MatFuse) |
| MatFusion (SIGGRAPH Asia 2023; the PBR base FabricDiffusion fine-tuned) | code and checkpoints; 2024-05-05 | Apache-2.0 | a LICENSE.txt ships inside each checkpoint archive (not read); its INRIA training set is "CC BY-NC-ND 2.0 ... This usage of the INRIA dataset has been permitted by Adobe" | flash or natural-light photo → SVBRDF | - | [README](https://github.com/samsartor/matfusion/blob/HEAD/README.md) |
| **CHORD** (Ubisoft La Forge, 2025: "PBR Material Estimation from Generated Texture Images") | code, gated weights, a ComfyUI node; 2025-12-09 | "Ubisoft Machine Learning License (Research-Only - Copyleft)" | same: "'Permitted Purpose': Use for academic or research purposes only. Commercial use is strictly prohibited." | texture image → PBR maps | uv, Python 3.12 | [LICENSE](https://github.com/ubisoft/ubisoft-laforge-chord/blob/HEAD/LICENSE) |
| RGB-X (Adobe, 2024) | code and weights; 2026-01-24 | "ADOBE RESEARCH LICENSE ... for noncommercial research purposes only" | same | photo ↔ intrinsic channels | - | [LICENSE](https://github.com/zheng95z/rgbx/blob/HEAD/LICENSE) |
| ControlMat (Adobe) | no code release found; a user asks "when do you plan to publish controlmat?" on the StableMaterials page (search) | - | - | - | - | [search](https://huggingface.co/gvecchio/StableMaterials/discussions) |
| DressCode's fabric generator (SIGGRAPH 2024) | released: a fine-tuned Stable Diffusion UNet plus three VAE decoders writing `texture_diffuse.png`, `texture_normal.png`, `texture_roughness.png` at 512 px, circular padding, prompt such as "Deep grey fabric"; 2024-10-07 | **no licence** in the repo or README | none found (search) | text → tileable fabric maps | - | [test_finetune.py](https://github.com/IHe-KaiI/DressCode/blob/HEAD/nn/material_gen/test_finetune.py); [weights (search)](https://huggingface.co/IHe-KaiI/DressCode/tree/main/material_gen) |
| Materialize | Unity desktop project; 2018-10-23 | GPL-3.0 | - | photo → height, normal, smoothness, AO by filters | a desktop app | [repo](https://github.com/BoundingBoxSoftware/Materialize) |

**FabricDiffusion, the details that decide its use**

- Both models are `StableDiffusionInstructPix2PixPipeline`s run in fp16; the input patch is resized to 256 × 256; the
  texture model's UNet and VAE convolutions are set to circular padding (so the output tiles); 20 steps,
  `image_guidance_scale=1.5`, `guidance_scale=7.`; the print model's dark background is keyed to alpha. —
  [pipeline.py (source)](https://github.com/humansensinglab/fabric-diffusion/blob/HEAD/pipeline.py)
- The authors on what is manual: "The regional captures for materials and prints are manually selected. In our paper,
  we used external software (Clo3D) to apply textures to garment assets. The texture and print locations need to be
  manually adjusted."; for uniform fabrics, "generating regional captures should be as simple as generating random
  bounding boxes within the object mask". — [issue 1 (source)](https://github.com/humansensinglab/fabric-diffusion/issues/1)
- Its PBR part (a fine-tuned MatFusion giving normal and roughness) is not released: "Yes, we plan to release the
  finetuned PBR model soon." (2025-03-11), with "Is there any update about the PBR model?" unanswered since
  2025-07-28; requests for the full code and the 100k texture dataset are open. —
  [issue 2 (source)](https://github.com/humansensinglab/fabric-diffusion/issues/2);
  [issue list (source)](https://github.com/humansensinglab/fabric-diffusion/issues?q=is%3Aissue)

**Making a swatch tile**

- Embark's texture-synthesis (MIT or Apache-2.0; a Rust library with a command line; example-based, no network): "By
  invoking inpaint mode together with tiling, we can make an existing image tile." Its maintainers: "We at Embark are
  not actively using or developing these crates" (last commit 2023-01-22). —
  [README (source)](https://github.com/EmbarkStudios/texture-synthesis/blob/HEAD/README.md)
- Tiled Diffusion (CVPR 2025) covers "seamlessly tiling of existing images" on SD, SDXL, SD 3 and ControlNet; the
  repository has **no LICENSE file** (last commit 2025-03-16). —
  [README (source)](https://github.com/madaror/tiled-diffusion/blob/HEAD/README.md)
- Dream Textures (GPL-3.0): "Use the 'Seamless' option to create textures that tile perfectly with no visible seam"
  and "Inpaint to fix up images and convert existing textures into seamless ones automatically". —
  [README (source)](https://github.com/carson-katri/dream-textures/blob/HEAD/README.md)

**Running the small models without their apps**

- spandrel (MIT, last commit 2026-04-12) is chaiNNer's model loading made a Python package
  (`ModelLoader().load_from_file(r"path/to/model.pth")`); its list of supported architectures includes SPAN and DAT,
  the two PBRify uses, and the base package "only contains architectures with permissive and public domain
  licenses". MV-Adapter loads its upscaler the same way. —
  [spandrel README (source)](https://github.com/chaiNNer-org/spandrel/blob/HEAD/README.md);
  [spandrel LICENSE (source)](https://github.com/chaiNNer-org/spandrel/blob/HEAD/LICENSE);
  [MV-Adapter pipeline_texture.py (source)](https://github.com/huanngzh/MV-Adapter/blob/HEAD/mvadapter/pipelines/pipeline_texture.py)
- PBRify's author on its limit: "The goal of a delighting pipeline is to remove baked lighting from textures. This
  lighting is what causes the majority of issues with PBR and height map generation. It's also incredibly difficult
  to pull off however. I trained an experimental delighting model and it simply does not perform well enough to be
  worthwhile." — [EXTRA_INFO (source)](https://github.com/Kim2091/PBRify_Remix/blob/HEAD/EXTRA_INFO.md)

### Inferences

- **What a photo adds for this studio is the colourway and the pattern** (a plaid, a stripe, a print's repeat, a
  faded dye): thread-level relief already exists on the shelf (fabrics drawn or baked at real size, CC0 sets). So the
  photo route need only deliver a flat, evenly lit, tileable colour tile at a known size in metres; normal and
  roughness can come from PBRify on that tile, or from a shelf weave laid under it.
- **The whole chain on one RTX 3090, from a command line**: photograph the cloth flat under soft light (or scan it);
  crop a repeat; make it tile (texture-synthesis's inpaint-and-tile, or the studio's own code); run PBRify's normal
  and roughness `.pth` through spandrel in a few lines of Python (or DeepBump's `cli.py` on the CPU); write the maps
  into a shelf folder under the names the shelf already reads. Nothing needs more than a few GB (PBRify's own
  low-memory chain is named for 6 GB) and all of it is licence-clean.
- **From a photo of someone wearing the garment**, put FabricDiffusion's normaliser first. Estimate, not measured: an
  SD 1.5-class model in fp16 at 256 px with three samples needs about 3 to 5 GB and seconds per crop. Its limits: 256
  px (a pattern and colour reference rather than a thread-level fabric; PBRify's CC0 upscaler can enlarge it), no
  physical scale (the tile's size in metres is set by hand), crops chosen by hand, and a weight licence nobody has
  written down (as a Stable Diffusion 1.5 / InstructPix2Pix derivative it carries at least the OpenRAIL-M use
  restrictions).
- **StableMaterials is the pick for "a worn green corduroy" with no photo**, where DressCode's unlicensed generator
  would have been the fabric-specific answer. MatFuse's MIT tag sits on weights trained partly on a dataset that
  MatFusion's README describes as CC BY-NC-ND, a reason to prefer StableMaterials or PBRify.
- **Material Palette** is the heavier, more faithful extractor (it learns the region as a concept and regenerates it
  up to 8K before decomposing): an estimate of minutes per material on a 3090, on a PyTorch 1.13 / diffusers 0.19.3
  stack that needs porting; no metallic or height.

### Gaps

- **Quality on cloth is unmeasured** in every source read; only FabricDiffusion and DressCode (unlicensed) target
  fabric at all.
- StableMaterials' and MatFuse's licence tags and FabricDiffusion's missing one come from search summaries of pages
  that could not be opened.
- The normal-map convention (OpenGL or DirectX) of PBRify's and DeepBump's outputs was not checked; the shelf
  distinguishes the two by file name.
- Material Palette's time and VRAM per material are not in its README; DeepBump's training data and whether
  Materialize builds on Linux today were not established.

## 2. Re-colouring or re-fabricking a ready-made garment that comes with its own baked colour texture

### Takeaway

No free tool was found that separates a garment texture's layout (panels, stitching, prints) from its fabric in one
step, and the one model built for "texture image to PBR maps" (CHORD) is research-only. It is a short pipeline of
known pieces: masks from the asset's own structure, a de-lighting or flattening pass (Marigold-IID-Lighting and
StableDelight are the permissively licensed candidates; PBRify's author calls de-lighting textures "incredibly
difficult"), and a layered rebuild in the studio's own code, with the diffusion add-ons as a way to make variants
rather than controlled re-fabrics.

### Cited Findings

- **Marigold-IID** (code Apache-2.0; "The models are licensed under RAIL++-M License", which says "Licensor claims no
  rights in the Output You generate using the Model"): the Lighting checkpoint v1.1 predicts "Albedo, diffuse Shading,
  and non-diffuse Residual", the Appearance checkpoint v1.1 "Albedo, Roughness, and Metallicity" (both 2025-05-15);
  `python script/iid/run.py --checkpoint prs-eth/marigold-iid-lighting-v1-1 --input_rgb_dir ...`, `--fp16`; also a
  diffusers pipeline; trained on HyperSim and InteriorVerse respectively, 1 to 4 steps (search). —
  [README (source)](https://github.com/prs-eth/Marigold/blob/HEAD/README.md);
  [LICENSE-MODEL.txt (source)](https://github.com/prs-eth/Marigold/blob/HEAD/LICENSE-MODEL.txt);
  [diffusers docs (search)](https://huggingface.co/docs/diffusers/v0.33.0/api/pipelines/marigold)
- **StableDelight**: "a cutting-edge solution for specular reflection removal from textured surfaces"; Apache-2.0 by
  its README's badge (no LICENSE file) and by the model card's tag (search); last commit 2025-09-18. —
  [README (source)](https://github.com/Stable-X/StableDelight/blob/HEAD/README.md);
  [model card (search)](https://huggingface.co/Stable-X/yoso-delight-v0-4-base)
- **PBRify_Remix** takes "diffuse or albedo texture maps" and returns normal and roughness (CC0); its author on
  de-lighting, quoted in §1: baked lighting "is what causes the majority of issues with PBR and height map
  generation". — [README (source)](https://github.com/Kim2091/PBRify_Remix/blob/HEAD/README.md);
  [EXTRA_INFO (source)](https://github.com/Kim2091/PBRify_Remix/blob/HEAD/EXTRA_INFO.md)
- **Material Anything** (CVPR 2025; MIT code, last commit 2025-12-25; weights on Hugging Face, licence unverified) is
  "a PBR material generation model for various 3D meshes, including texture-less, albedo-only, generated, and scanned
  objects": "For objects with pre-existing textures, we directly process them. Next, a material estimator
  progressively estimates materials for each view from a rendered image, normal, and confidence mask ... These
  materials are then unwrapped into UV space and refined by a material refiner"; outputs albedo, roughness, metallic
  and bump; its scripts "are based on Blender 3.2.2". —
  [README (source)](https://github.com/3DTopia/MaterialAnything/blob/HEAD/README.md)
- **IDArb** (ICLR 2025; MIT code, last commit 2025-07-09) does "Single Image Intrinsic Decomposition" and multi-view
  decomposition (`python main.py --data_dir example/single --output_dir output/single --input_type single`). —
  [README (source)](https://github.com/lizb6626/IDArb/blob/HEAD/README.md)
- **DiffusedTexture** (GPL-3.0): "image-to-texture refinement" from an existing texture as "Input Texture"; "Lower
  denoise preserves more of the original texture; higher denoise allows a stronger variation"; its own multi-pass
  example notes that a later pass "visibly softens the wood grain and small blood speckles" and "does not restore the
  fine detail"; after projection "a stitching pass evens out color jumps across UV seams" and island edges are
  extended "by the Texture Margin (16 px at 2048 ...)". —
  [README (source)](https://github.com/FrederikHasecke/diffused-texture-addon/blob/HEAD/README.md);
  [DOCUMENTATION (source)](https://github.com/FrederikHasecke/diffused-texture-addon/blob/HEAD/documentation/DOCUMENTATION.md)
- **StableGen** (GPL-3.0, drives ComfyUI): "Masked Edit regenerates only the painted region, in every view that sees
  it, and leaves the rest of the texture as it was"; "Marigold estimates albedo, roughness, metallic and normal maps
  from the generated views"; PBR extraction is also a step "done by hand". —
  [README (source)](https://github.com/sakalond/StableGen/blob/HEAD/README.md)
- **Masks**: SAM 2 is Apache-2.0 (last commit 2024-12-15); BiRefNet (MIT, 2026-10-25) and rembg (MIT, 2026-11-05)
  cut a subject from its background. — [SAM 2 LICENSE (source)](https://github.com/facebookresearch/sam2/blob/HEAD/LICENSE);
  [BiRefNet LICENSE (source)](https://github.com/ZhengPeng7/BiRefNet/blob/HEAD/LICENSE);
  [rembg LICENSE (source)](https://github.com/danielgatis/rembg/blob/HEAD/LICENSE.txt)
- **Blocked**: CHORD (research-only, §1); Hunyuan3D-2's "Image Delight Model" `hunyuan3d-delight-v2-0` (Tencent
  licence, §6); RGB-X (Adobe research licence); Careaga and Aksoy's Intrinsic ("This software is for academic use
  only."); IntrinsicAnything asks that company "Project Use is registered before such use begins" through a form
  (entity name, contact, project). —
  [Hunyuan3D-2 README (source)](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/HEAD/README.md);
  [Intrinsic LICENSE (source)](https://github.com/compphoto/Intrinsic/blob/HEAD/LICENSE);
  [IntrinsicAnything LICENSE (source)](https://github.com/zju3dv/IntrinsicAnything/blob/HEAD/LICENSE)

### Inferences

These steps are standard texture practice written for this studio's case; none is a finding of this research.

- **Masks first, from the asset itself.** A designed garment already says where its panels are: connected islands in
  UV space are its panels (pattern-made garments keep one island a panel), material slots separate trims, zips and
  buttons, and where the asset ships normal, roughness or AO maps, stitching and seams are in them rather than in the
  colour. What the layout does not give (a print inside a panel, a contrast yoke, a pocket) comes from clustering the
  colour texture in a perceptual colour space, or from a few clicks in SAM 2 on the texture or on a render.
- **Flatten the old colour into a detail layer.** Inside each mask, divide the texture's lightness by its
  low-frequency (blurred) lightness: what is left near 1.0 is stitching, seam shading, piping and wear; the dominant
  colour and the soft baked shading go. A de-lighting model in front (Marigold-IID-Lighting's albedo, or StableDelight
  for sheen) helps when the source has painted or baked light; both are trained on photographs, and a UV atlas is not
  a photograph, so they may do better on a render of the garment whose result is then baked back.
- **Rebuild as layers**, which is what the studio's fabric code already does for its own garments: a tileable fabric
  set at real size under each panel mask (a second UV channel, or a per-island scale and grain angle worked out from
  the island's area in 3D against its area in UV, since a ready-made garment's UVs are not in metres), multiplied by
  the detail layer, with the masked prints and trims put back on top and their own roughness. Normal maps blend the
  same way (fabric normal plus the asset's or PBRify's seam normal).
- **Bake the result back into the garment's own UVs** as plain base colour, ORM and normal for the export, as the
  studio's garments already are; the recipe (which set under which mask) stays editable.
- **Recolouring alone is the easy case**: a hue or a tint through a panel mask over the flattened detail layer, with
  no new fabric at all.
- **The diffusion add-ons answer a different wish.** DiffusedTexture's texture-to-texture and StableGen's Masked
  Edit repaint the garment from a prompt; they keep the layout only loosely and lose fine detail with each pass, so
  they suit "give me three more versions of this jacket", not "the same jacket in my wool".
- **Material Anything is the one released model aimed at "albedo-only mesh in, PBR maps out"**, and would stand in
  for PBRify when the asset's colour texture is clean; it needs its weight licence read and its Blender 3.2.2 scripts
  brought up to date before it is worth a test.

### Gaps

- **No search was made for this question** (it arrived with the instruction to wrap up): dedicated texture
  de-lighting tools, tint-mask workflows in other engines, and papers on separating garment prints from fabric were
  not looked for. The findings above are only what the repositories already read for the other questions contain.
- Whether Marigold-IID or StableDelight behaves on a UV atlas, and how either does on cloth, is untested and unreported.
- Material Anything's and IDArb's weight licences (Hugging Face) are unverified.

## 3. Placing PNG decals and prints on arbitrary garments (projection, baking into the texture)

### Takeaway

This needs no model: a decal is a projector placed on the surface, the triangles under it clipped to its footprint,
and the picture either kept as a thin mesh on top or written into the garment's own texture through its UVs. three.js
(which the studio's tools are built on) ships the projector-and-clip half under MIT; the AI texture tools read for
§4 all contain the bake half (project, weight by facing, dilate over seams); and Godot's own runtime Decal node is a
box projection that is the wrong tool for skinned clothes.

### Cited Findings

- **three.js `DecalGeometry`** (MIT; `three/addons/geometries/DecalGeometry.js`; three.js last commit 2026-11-11):
  "This class can be used to create a decal mesh that serves different kinds of purposes e.g. adding unique details
  to models, performing dynamic visual environmental changes or covering seams. Please not[e] that decal projections
  can be distorted when used around corners."; `new DecalGeometry( mesh, position, orientation, size )`; it cites
  Wolfire's "How to project decals" and ships an example, `webgl_decals`. —
  [DecalGeometry.js (source)](https://github.com/mrdoob/three.js/blob/HEAD/examples/jsm/geometries/DecalGeometry.js);
  [LICENSE (source)](https://github.com/mrdoob/three.js/blob/HEAD/LICENSE)
- **Godot's Decal node**: "Decals are projected textures that apply on opaque or transparent surfaces in 3D. This
  projection happens in real-time and doesn't rely on mesh generation."; "Decals cannot affect material properties
  other than the ones listed above, such as height"; "decals cannot use custom shaders"; Forward+ counts decals among
  a "default limit of 512 clustered elements"; "When using the Mobile renderer, only 8 decals can be applied on each
  individual Mesh resource" (the same for Compatibility); a **Cull Mask** chooses which layers a decal projects on. —
  [using_decals.rst (source)](https://github.com/godotengine/godot-docs/blob/HEAD/tutorials/3d/using_decals.rst)
- **The bake half, as the texture tools do it**: StableProjectorz's projector "'Shines' the AI image inside the
  `_accumulation_uv_RT` texture" in a loop "Clear Black → Bake Projections (respecting depth) → Dilate (Anti-Seam) →
  Display on Mesh", per UDIM tile; DiffusedTexture projects each pixel "back into UV space, weighted by how directly
  the surface faces that camera" and then extends island edges by a margin; Hunyuan3D-Paint weights by the cosine to
  the view raised to a power (`project_cos_map ** self.config.bake_exp`) and inpaints the UV holes. —
  [StableProjectorz README (source)](https://github.com/IgorAherne/stableprojectorz/blob/HEAD/README.md);
  [DiffusedTexture DOCUMENTATION (source)](https://github.com/FrederikHasecke/diffused-texture-addon/blob/HEAD/documentation/DOCUMENTATION.md);
  [Hunyuan3D-2 pipelines.py (source)](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/HEAD/hy3dgen/texgen/pipelines.py)
- **A projection tool that must not be used for this**: Dream Textures' projection changes the mesh ("The UVs for
  each selected face are also updated to be projected from the angle the material was generated at"). —
  [TEXTURE_PROJECTION.md (source)](https://github.com/carson-katri/dream-textures/blob/HEAD/docs/TEXTURE_PROJECTION.md)
- **Bakers assume a clean UV map**: DiffusedTexture "needs one UV map whose islands don't overlap. Assets that give
  each material its own full 0–1 UV layout (common for game-ready models) must be re-unwrapped first"; SyncMVD asks
  to "avoid flipped face normals and overlapping UV". —
  [DiffusedTexture DOCUMENTATION (source)](https://github.com/FrederikHasecke/diffused-texture-addon/blob/HEAD/documentation/DOCUMENTATION.md);
  [SyncMVD README (source)](https://github.com/LIU-Yuxin/SyncMVD/blob/HEAD/README.md)
- **Where a PNG can come from**: FabricDiffusion's print model returns a flat print with an alpha channel from a crop
  of a photographed garment (256 px), its authors noting that "The texture and print locations need to be manually
  adjusted" and that finding prints automatically would mean fine-tuning "a standard object detection model using
  print data"; BiRefNet and rembg (MIT) cut any picture's subject out to alpha. —
  [pipeline.py (source)](https://github.com/humansensinglab/fabric-diffusion/blob/HEAD/pipeline.py);
  [issue 1 (source)](https://github.com/humansensinglab/fabric-diffusion/issues/1);
  [BiRefNet (source)](https://github.com/ZhengPeng7/BiRefNet/blob/HEAD/LICENSE)

### Inferences

Standard practice written for this studio's case, not findings.

- **Bake, don't project at run time.** The clothes are skinned and never simulated; a decal written into the
  garment's texture deforms with the cloth for free, costs nothing in the game and works in every renderer. Godot's
  Decal is a box in space: parented to a bone it rides that bone rigidly while the cloth under it bends, and outside
  Forward+ a mesh takes only eight.
- **The algorithm, in the studio's page** (it already raycasts garments and bakes prints on its own panels): pick a
  point on the garment; build a projector there from the surface normal, an up direction and a size in metres; for
  every texel of the garment's texture whose 3D rest-pose position falls inside the projector's box and whose normal
  faces it, look the PNG up at the projected coordinate and blend by its alpha (and by a fade on the facing angle);
  dilate a few texels over island edges. Because each texel finds the decal through its 3D position, a decal that
  crosses a seam lands correctly on both islands, which a paste in UV space cannot do. `DecalGeometry` gives the same
  footprint as clipped triangles with decal coordinates, which can be rendered straight into UV space instead.
- **Store the decal as data, not pixels**: the triangle and barycentric point it sits on, its turn, its size in
  metres, the PNG and which maps it writes (colour only for a print; colour, roughness and a normal for a patch or
  embroidery, with PBRify or DeepBump making the patch's normal). Then it survives a refit to another body and can be
  moved later, as the tailor's prints and the Character Studio's accessories already do.
- **Two traps with ready-made assets.** Mirrored or overlapping UVs (left and right sleeves sharing texels, tiled
  trims) would print the decal twice: detect texels claimed by more than one triangle and, for those garments, either
  add a second non-overlapping UV channel for a decal layer or keep the decal as a thin skinned mesh patch (the
  `DecalGeometry` mesh, offset a fraction of a millimetre, weights copied from the garment's nearest vertices). And a
  flat projector stretches on strongly curved cloth (three.js's own warning): keep decals small relative to the
  curvature, or lay the picture along the surface from its centre instead of projecting it.
- **Texel budget**: a chest print 20 cm wide on a garment whose 2K texture covers about a metre of cloth gets about
  400 texels across; a garment that will carry fine print wants a 4K bake or the decal kept as a mesh patch with its
  own small texture.

### Gaps

- **No search was made for this question**: free decal add-ons for Blender, glTF-level conventions for decal layers,
  and distortion-free ("exponential map") decal papers were not looked for.
- How Godot's Decal behaves on a skinned MeshInstance3D is inferred from the documentation's description of it as a
  real-time box projection; the documentation read does not discuss skinned meshes.

## 4. Whole-garment AI texturing since Cloth2Tex (garment-specific and general): one ranked table

### Takeaway

Nothing released since Cloth2Tex both takes an existing garment with its UVs and is free to use for a sold game on a
24 GB card with good results shown on clothing. The two systems that really fill the niche, **OmniFabric** (SIGGRAPH
Asia 2026, code published 2026-11-01) and **NI-Tex** (CVPR 2026), are closed by FLUX.1-dev, Hunyuan and memory; the
usable ones are Stable Diffusion projection painters in maintained Blender add-ons, and **TRELLIS.2**'s texturing
pipeline (MIT, PBR, keeps UVs) after one dependency is replaced.

### Cited Findings

| Rank | Method (venue; last commit) | One line | Licence: code / weights | VRAM (whose figure) | Own UVs | Verdict | Source |
|---|---|---|---|---|---|---|---|
| 1 | **DiffusedTexture** (Blender add-on; 2026-10-24) | SD 1.5 or SDXL with depth / canny / normal ControlNets, IP-Adapter and LoRA; 4, 9 or 16 views baked to a UV texture up to 4096 px; lighting baked in | GPL-3.0 / SD 1.5 OpenRAIL-M, SDXL RAIL++-M | "SD 1.5 ... peaked at 3.7 GiB"; "SDXL needs about 10 GiB" at 768; about 2.5 minutes on a 3080 Ti (authors) | kept (one non-overlapping map) | usable now | [README](https://github.com/FrederikHasecke/diffused-texture-addon/blob/HEAD/README.md) |
| 2 | **StableGen** (Blender add-on on ComfyUI; 2026-11-04) | views generated in sequence with context, projected and blended; SDXL + ControlNet + IPAdapter or Qwen Image; Marigold and StableDelight for PBR; masked edits | GPL-3.0 / per model (it lists Qwen Image 2.1 and Bria FIBO as non-commercial) | "about 8 GB of VRAM for SDXL, and 16 GB or more for Qwen Image" (authors) | bakes to a "BakeUV" map beside the original | usable now (needs ComfyUI) | [README](https://github.com/sakalond/StableGen/blob/HEAD/README.md); [game_export.py](https://github.com/sakalond/StableGen/blob/HEAD/stablegen/texturing/game_export.py) |
| 3 | **TRELLIS.2** texturing (Microsoft, Dec 2025; 2026-06-05) | a mesh and one image to base colour, metallic, roughness, alpha at 1024 to 4096 px, sampled from a generated voxel grid; lists "Open Surfaces (e.g., clothing, leaves)" as handled | MIT / MIT; needs nvdiffrast and nvdiffrec (non-commercial), DINOv3 (own licence, commercial use granted) | "at least 24GB of memory is necessary"; verified on A100 and H100 (authors) | kept when present | usable with work | [README](https://github.com/microsoft/TRELLIS.2/blob/HEAD/README.md); [trellis2_texturing.py](https://github.com/microsoft/TRELLIS.2/blob/HEAD/trellis2/pipelines/trellis2_texturing.py) |
| 4 | Re-posing by an Apache-2.0 image editor, then our own bake (OmniFabric's step 3 with FLUX.2 [klein] 4B or Qwen-Image-Edit) | the editor paints our grey render of the garment from a reference photo; we project it | Apache-2.0 / Apache-2.0 | klein 4B "fits in ~8GB VRAM" (authors); Qwen-Image-Edit-2511 4-bit "less than 20GB" (a community build, search) | ours | usable with work, unproven | [FLUX.2 README](https://github.com/black-forest-labs/flux2/blob/HEAD/README.md); [Qwen-Image README](https://github.com/QwenLM/Qwen-Image/blob/HEAD/README.md); [4-bit build (search)](https://huggingface.co/libaya/Qwen-Image-Edit-2511-4bit) |
| 5 | SyncMVD (SIGGRAPH Asia 2024; 2025-03-18) | synchronised multi-view SD 1.5 with depth and normal ControlNets; text prompt; 1024 px RGB by default; "within around 40,000" triangles advised | MIT / OpenRAIL-M; PyTorch3D (BSD) | not stated | kept ("read the original UV mapping") | usable with work | [README](https://github.com/LIU-Yuxin/SyncMVD/blob/HEAD/README.md); [configs.py](https://github.com/LIU-Yuxin/SyncMVD/blob/HEAD/src/configs.py) |
| 6 | Paint3D (CVPR 2024; 2024-11-05) | "lighting-less ... 2K UV texture maps ... conditioned on text or image"; SD 1.5 with a UV-position ControlNet; Kaolin 0.13, PyTorch 1.12.1 | Apache-2.0 / UV-position ControlNet unverified | not stated | kept | usable with work | [README](https://github.com/OpenTexture/Paint3D/blob/HEAD/README.md) |
| 7 | MV-Adapter texture pipeline (ICCV 2025; 2025-06-26) | six 768 px views from text or an image, upscaled, projected to a 4096 px UV map; "`_shaded.glb`" (shading baked) | Apache-2.0 / apache-2.0 (search); nvdiffrast throughout, CV-CUDA | SDXL ">16G", SD 2.1 "<10G" (authors); a 3090 user: SD 2.1 runs, SDXL "killed after 31 GB System RAM" | kept | usable with work (rasteriser to replace) | [README](https://github.com/huanngzh/MV-Adapter/blob/HEAD/README.md); [issue 66](https://github.com/huanngzh/MV-Adapter/issues/66); [weights (search)](https://huggingface.co/huanngzh/mv-adapter) |
| 8 | Material Anything (CVPR 2025; 2025-12-25) | text or an existing albedo to albedo, roughness, metallic, bump, refined in UV space | MIT / unverified | not stated | not checked | usable with work | [README](https://github.com/3DTopia/MaterialAnything/blob/HEAD/README.md) |
| 9 | Step1X-3D texture (2025-09-09) | SDXL multi-view painter after MV-Adapter; reuses Hunyuan3D 2.0's rasteriser and renderer; nvdiffrast | Apache-2.0 / Apache-2.0 (its README) | 27 to 29 GB with geometry (authors) | not checked | unlikely | [README](https://github.com/stepfun-ai/Step1X-3D/blob/HEAD/README.md) |
| 10 | FlashTex (ECCV 2024), DreamMat (SIGGRAPH 2024), Paint-it (CVPR 2024), TEXTure (SIGGRAPH 2023) | optimisation or early projection methods; nvdiffrast or Kaolin; FlashTex: "Baked-in lighting still exists in generated albedo"; DreamMat: a 15-minute Blender pre-render "on a 4090" first; Paint-it developed on a 48 GB card | Apache-2.0, MIT, MIT, MIT / SD-based | not stated | - | superseded | [FlashTex](https://github.com/Roblox/FlashTex/blob/HEAD/README.md); [DreamMat](https://github.com/zzzyuqing/DreamMat/blob/HEAD/README.md); [Paint-it](https://github.com/postech-ami/Paint-it/blob/HEAD/README.md); [TEXTure](https://github.com/TEXTurePaper/TEXTurePaper/blob/HEAD/README.md) |
| - | **OmniFabric** (SIGGRAPH Asia 2026; 2026-11-01) | one photo to a de-lit texture written into sewing-pattern UV space: ChatGarment pattern, FLUX.2-dev or Gemini re-texturing of a grey render, a 360° video for the other views, projection, then a FLUX.1-dev LoRA that normalises in UV space from a 3D position map | Apache-2.0 / a FLUX.1-dev LoRA, FLUX.2-dev, Hunyuan3D-2, MiniMax-H3, Llama 2 inside ChatGarment | "a single 48 GB GPU: FLUX.2-dev (4-bit NF4) needs about 28 GB, FLUX.1-dev with the OmniFabric LoRA about 35 GB"; about 200 GB of downloads (authors) | its own patterns | not usable | [README](https://github.com/humansensinglab/OmniFabric/blob/HEAD/README.md); [INSTALL](https://github.com/humansensinglab/OmniFabric/blob/HEAD/docs/INSTALL.md) |
| - | **NI-Tex** (CVPR 2026; 2026-04-12) | `mesh.glb` + `image_prompt.png` (the photo's garment need not match the mesh) to albedo and metallic-roughness at 4096 px; Hunyuan3D-2.1's painter retrained on Objaverse, TexVerse and BEDLAM | **no LICENSE file** / unverified; a Hunyuan 2.1 derivative | "cuda 12.4 on H100/H200" (authors) | replaced (`mesh_uv_wrap`) | not usable | [README](https://github.com/SII-Hui/NI-Tex/blob/HEAD/README.md); [inference.py](https://github.com/SII-Hui/NI-Tex/blob/HEAD/inference.py) |
| - | Hunyuan3D-Paint 2.0 (2025-10-28) and 2.1 = MaterialMVP (ICCV 2025; 2025-10-17) | the strongest open multi-view painters; 2.0 RGB at 2048 px from a de-lit reference image; 2.1 albedo and metallic-roughness at 4096 px | Tencent Hunyuan 3D Community Licence (both) | 2.0: "16 GB for shape and texture generation in total"; 2.1: "21GB for texture generation" (authors) | replaced (`mesh_uv_wrap`; 2.1 `use_remesh=True`) | not usable (territory) | [2.0 README](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/HEAD/README.md); [2.1 README](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/README.md); [2.1 pipeline](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/hy3dpaint/textureGenPipeline.py) |
| - | UniTEX (CVPR 2026, search; 2026-03-20) | image-to-texture through a 3D function space; loads `black-forest-labs/FLUX.1-dev` | Apache-2.0 / FLUX.1-dev LoRAs | not stated | - | not usable | [run.py](https://github.com/YixunLiang/UniTEX/blob/HEAD/run.py) |
| - | SeqTex (SIGGRAPH Asia 2025; 2025-12-12), TEXGen (SIGGRAPH Asia 2024), MVPaint (CVPR 2025), TexGaussian (CVPR 2025), InTeX | UV-native or multi-view generators; SeqTex and TEXGen write directly in the mesh's UV space | **no LICENSE file** in any of the five | SeqTex "tested with 1 × NVIDIA A100 80GB"; TEXGen "24GB VRAM will be fine" for testing | - | not usable (unlicensed) | [SeqTex](https://github.com/VAST-AI-Research/SeqTex/blob/HEAD/README.md); [TEXGen](https://github.com/CVMI-Lab/TEXGen/blob/HEAD/README.md); [MVPaint](https://github.com/3DTopia/MVPaint/blob/HEAD/README.md); [TexGaussian](https://github.com/ymxbj/TexGaussian/blob/HEAD/README.md); [InTeX](https://github.com/ashawkey/InTeX/blob/HEAD/readme.md) |
| - | Text2Tex; Garment3DGen (3DV 2025); Pix2Surf (CVPR 2020) | Garment3DGen's repo holds only the geometry stylisation, no texture module; Pix2Surf renders on SMPL | CC BY-NC-SA 3.0; CC BY-NC 4.0; "non-commercial scientific research, non-commercial education, or non-commercial artistic projects" | - | - | not usable | [Text2Tex](https://github.com/daveredrum/Text2Tex/blob/HEAD/LICENSE); [Garment3DGen](https://github.com/nsarafianos/Garment3DGen/blob/HEAD/LICENSE.md); [Pix2Surf](https://github.com/aymenmir1/pix2surf/blob/HEAD/LICENSE.txt) |
| - | DeepIron (Eurographics 2024), TexGarment (CVPR 2025), GarmentPainter (arXiv, March 2026), EASI-Tex (SIGGRAPH 2024) | garment or image-conditioned UV texture papers | no code found (EASI-Tex's repository is a project page only) | - | - | no code | [DeepIron (search)](https://arxiv.org/abs/2310.15447v2); [TexGarment (search)](https://cvpr.thecvf.com/virtual/2025/poster/34341); [GarmentPainter (search)](https://arxiv.org/abs/2603.08228); [EASI-Tex](https://github.com/sairajk/easi-tex) |

**The facts behind the cross-cutting blockers**

- nvdiffrast's licence, "Nvidia Source Code License (1-Way Commercial)": "3.3 Use Limitation. The Work and any
  derivative works thereof only may be used or intended for use non-commercially. ... 'non-commercially' means for
  research or evaluation purposes only and not for any direct or indirect monetary gain." nvdiffrec says the same.
  SeqTex's own notice reads it so: "Commercial Use: Requires separate licensing from NVIDIA". —
  [nvdiffrast LICENSE.txt (source)](https://github.com/NVlabs/nvdiffrast/blob/HEAD/LICENSE.txt);
  [nvdiffrec LICENSE.txt (source)](https://github.com/NVlabs/nvdiffrec/blob/HEAD/LICENSE.txt);
  [SeqTex third_party_license.md (source)](https://github.com/VAST-AI-Research/SeqTex/blob/HEAD/third_party_license.md)
- TRELLIS.2 uses nvdiffrast in one place in its texturing path: after generating the voxel grid it rasterises the
  mesh's UVs (`dr.RasterizeCudaContext()`, `dr.rasterize`, `dr.interpolate`) to get each texel's 3D position, samples
  the grid there and fills holes with `cv2.inpaint`; it keeps the incoming map (`if hasattr(mesh, 'visual') and
  hasattr(mesh.visual, 'uv')`) and exports `doubleSided=True`. Its other compiled parts (CuMesh, FlexGEMM) are MIT;
  its background remover is BiRefNet (MIT). —
  [trellis2_texturing.py (source)](https://github.com/microsoft/TRELLIS.2/blob/HEAD/trellis2/pipelines/trellis2_texturing.py);
  [CuMesh LICENSE (source)](https://github.com/JeffreyXiang/CuMesh/blob/HEAD/LICENSE)
- DINOv3's licence grants "a non-exclusive, worldwide, non-transferable and royalty-free limited license ... to use,
  reproduce, distribute, copy, create derivative works of, and make modifications to the DINO Materials" and forbids
  ITAR, military, nuclear, espionage and weapons uses. —
  [DINOv3 LICENSE.md (source)](https://github.com/facebookresearch/dinov3/blob/HEAD/LICENSE.md)
- TRELLIS.2 on 24 GB in the field: the one issue from a 4090 owner running `example_texturing.py` ("Why did I get
  stuck here for so long when I was using the 4090 24g GPU?") got no technical answer. —
  [issue 93 (source)](https://github.com/microsoft/TRELLIS.2/issues/93)
- OmniFabric's licence paragraph: "The pipeline depends on third-party models and code with their own licenses,
  several of them non-commercial and/or with territorial restrictions — in particular the FLUX.1-dev and FLUX.2-dev
  non-commercial licenses, the Tencent Hunyuan 3D community license, and the MiniMax-H3 community license, which does
  not grant use in the EU, the UK, South Korea, or the USA." Its normaliser takes a UV template mask, a coarse UV
  texture, a position map normalised with fixed dataset ranges, and a frontal render, on a 1024 px canvas. —
  [README (source)](https://github.com/humansensinglab/OmniFabric/blob/HEAD/README.md);
  [normalize/infer.py (source)](https://github.com/humansensinglab/OmniFabric/blob/HEAD/omnifabric/normalize/infer.py)
- MV-Adapter has no PBR output: a request for "illumination-free albedo/base color plus normal, roughness, metallic,
  and AO" is open and unanswered since 2025-08. — [issue 62 (source)](https://github.com/huanngzh/MV-Adapter/issues/62)

### Inferences

- **For ready-made garments this table matters less than §1 to §3**: a designed garment already has a texture, and
  the user's wish is to re-dress it with their own fabric and decals, which no model here does better than the
  layered rebuild. The painters earn a place only for garments that arrive untextured, or for making variants.
- **A painter conditioned on one image invents a texture that resembles it**, at 512 to 768 px a view over the whole
  garment, with invented backs; it does not copy a specific garment's panels and prints. That is the gap OmniFabric
  and NI-Tex were built to close, and both are closed to this studio.
- **TRELLIS.2 is the only general painter that passes on its own code and weights.** To use it: replace the three
  nvdiffrast calls with any UV-space rasterisation that yields each texel's 3D position (the studio's page computes
  the same thing when it bakes), keep nvdiffrec out of the import path, and test on the 3090. It gives base colour,
  metallic and roughness but no normal map, which fits a pipeline where the fabric's relief comes from a shelf set.
- **What OmniFabric contributes is two ideas**: pixel-aligned views by having an image editor re-texture a grey
  render of the garment itself (row 4 tries that with Apache-2.0 editors; nobody has published it with them), and
  clean-up in UV space conditioned on each texel's 3D position (no licence-clean model exists).
- **Body model**: none of these assumes one except Pix2Surf (SMPL); MHR makes no difference to any of them.

### Gaps

- No report was found of any of these painters on thin garment shells specifically; TRELLIS.2's claim is its authors'.
- Unverified weight licences (Hugging Face unreachable): Paint3D's UV-position ControlNet, Material Anything, NI-Tex,
  SeqTex, TEXGen, MVPaint (Dropbox), FlashTex's LightControlNet.
- TRELLIS.2's VRAM for texturing alone is not stated anywhere found. OmniFabric is ten days old: no third-party runs.
- RomanTex (Tencent) was not found under the repository names tried; Hunyuan3D 2.5 and later were not examined.
- "No code found" for DeepIron, TexGarment and GarmentPainter rests on one search each.

## 5. Free apps and Blender add-ons that wrap these for artists

### Takeaway

Two maintained free add-ons paint on a mesh with Stable Diffusion: **DiffusedTexture** (GPL-3.0, self-contained in
Blender, last commit 2026-10-24) and **StableGen** (GPL-3.0, needs a ComfyUI server it can install itself, last commit
2026-11-04, with PBR extraction and masked edits). StableProjectorz is now open source (AGPL-3.0) but is a Unity
desktop app; Dream Textures is alive but its projection overwrites UVs; ComfyUI-3D-Pack mostly repackages the
licence-blocked models.

### Cited Findings

| App | Licence, last commit | What it wraps | Strings | UVs | Scriptable without its UI | Source |
|---|---|---|---|---|---|---|
| **DiffusedTexture** | GPL-3.0; 2026-10-24; "Blender 4.2 or newer (tested through 5.2 LTS)"; "Windows x64 or Linux x64" | "Stable Diffusion 1.5 or SDXL. Depth, canny and normal ControlNets ... projected and baked into your UV map. Everything runs locally ... It supports text-to-texture, image-to-texture refinement, LoRA and IP-Adapter" | none beyond the models' own; diffusers runs inside Blender's Python, no ComfyUI; "about 5 GB for the Python dependencies, plus 11 GB for the SD 1.5 models or 21 GB for SDXL" | "The mesh therefore needs one UV map whose islands don't overlap" | not documented; the repo drives itself from Blender Python in `scripts/media/blender/generate.py` and a CI smoke script | [README](https://github.com/FrederikHasecke/diffused-texture-addon/blob/HEAD/README.md); [DOCUMENTATION](https://github.com/FrederikHasecke/diffused-texture-addon/blob/HEAD/documentation/DOCUMENTATION.md) |
| **StableGen** | GPL-3.0; 2026-11-04; "Blender 4.2 to 4.5, or 5.1 and later" | SDXL with ControlNet and IPAdapter, Qwen Image; Marigold and StableDelight for PBR maps; Masked Edit; TRELLIS.2 for meshes; bake and glTF export | "sends the work to a ComfyUI server"; its own licence note: "three of them are for non-commercial use only": Qwen Image 2.1 / 2.1 Turbo ("Qwen Research License ... Qwen Image Edit and SDXL are not affected"), Bria FIBO 2.0 (CC BY-NC 4.0), and DINOv3's own licence under TRELLIS.2 | after Bake the first UV channel "is usually the model's original UV map, while the baked texture uses the BakeUV map" | a command-line installer (`python installer.py <path to ComfyUI> --packages 3,8`) and a "Batch processing and the Scene Queue" wiki page; generation runs from Blender's panel | [README](https://github.com/sakalond/StableGen/blob/HEAD/README.md); [game_export.py](https://github.com/sakalond/StableGen/blob/HEAD/stablegen/texturing/game_export.py) |
| **StableProjectorz** | AGPL-3.0; 2026-08-23; "Requirements: Unity 6000" | "a tool for texturing 3D models using StableDiffusion"; talks "to A1111/Forge via JSON" | "A free tool"; needs an A1111 or Forge server | bakes into the model's UVs, UDIM aware | no: a Unity application | [README](https://github.com/IgorAherne/stableprojectorz/blob/HEAD/README.md); [LICENSE](https://github.com/IgorAherne/stableprojectorz/blob/HEAD/LICENSE) |
| **Dream Textures** | GPL-3.0; 2026-09-17; version 0.4.1 | Stable Diffusion in Blender: generation, "Seamless", inpaint and outpaint, upscaling, "Project Dream Texture" with a depth model | optional DreamStudio cloud processing | overwritten by projection | has an `api` package and community backends | [README](https://github.com/carson-katri/dream-textures/blob/HEAD/README.md); [TEXTURE_PROJECTION](https://github.com/carson-katri/dream-textures/blob/HEAD/docs/TEXTURE_PROJECTION.md) |
| ComfyUI-3D-Pack | MIT; 2025-11-17 | nodes for Hunyuan3D 2.0 / 2.1 ("3D mesh + reference image → 3D mesh with RGB texture"), MV-Adapter texturing, TRELLIS and others | each wrapped model keeps its own licence | per model | through ComfyUI's workflow API | [README](https://github.com/MrForExample/ComfyUI-3D-Pack/blob/HEAD/README.md) |
| ComfyUI-Hunyuan3DWrapper (kijai) | ships the Tencent Hunyuan 3D 2.0 licence as its own; 2026-03-16 | Hunyuan3D 2.x in ComfyUI | Tencent licence | - | through ComfyUI | [LICENSE.txt](https://github.com/kijai/ComfyUI-Hunyuan3DWrapper/blob/HEAD/LICENSE.txt) |
| chaiNNer | GPL-3.0; 2026-11-02 | node editor that runs PBRify's chain | - | n/a | the models load without it (spandrel) | [repo](https://github.com/chaiNNer-org/chaiNNer) |
| ArmorPaint | zlib source, "Distributed binaries are paid"; 2026-11-10 | PBR texture painting; no separate ArmorLab tree at HEAD (only `base` and `paint`) | build it yourself or pay | - | - | [readme](https://github.com/armory3d/armortools/blob/HEAD/readme.md) |

### Inferences

- All four GPL / AGPL tools are fine to run for a commercial game: what ships is the texture, whose terms come from
  the image model (§6), not from the tool.
- **Fit with "avoid ComfyUI and outside apps"**: DiffusedTexture is nearest (Blender is already used headless, no
  server), though driving it from a script means reading its code; StableGen is richer but means a ComfyUI process;
  StableProjectorz is a hand tool.
- For the three questions that now lead this note, these apps are optional: §1's models load from plain Python, and
  §2 and §3 are best done in the studio's own page.

### Gaps

- Whether DiffusedTexture or StableGen runs fully headless (`blender -b`) is not documented in what was read; whether
  StableGen can bake into the original UV map instead of "BakeUV" was not checked.
- StableProjectorz on Linux, and its release binaries' terms, were not checked.

## 6. What the base image models' licences mean for selling a game that contains the generated textures

### Takeaway

Stable Diffusion 1.5 and SDXL (OpenRAIL-M and RAIL++-M) claim nothing on outputs and allow commercial use, as do the
Apache-2.0 models (FLUX.1-schnell, FLUX.2 [klein] 4B, Qwen-Image and Qwen-Image-Edit, Z-Image-Turbo) and MIT
TRELLIS.2. FLUX.1-dev and FLUX.2-dev say outputs may be used commercially but forbid *using the model* for a
revenue-generating activity. Hunyuan's licence forbids using or distributing its outputs in the EU, the UK and South
Korea, which a worldwide release cannot honour.

### Cited Findings

- **Stable Diffusion 1.x** (CreativeML Open RAIL-M): "6. The Output You Generate. Except as set forth herein, Licensor
  claims no rights in the Output You generate using the Model. You are accountable for the Output you generate and its
  subsequent uses. No use of the output can contravene any provision as stated in the License." **SDXL 1.0**
  (CreativeML Open RAIL++-M) and **Marigold's checkpoints** (OpenRAIL++-M) carry the same clause. —
  [SD LICENSE (source)](https://github.com/CompVis/stable-diffusion/blob/HEAD/LICENSE);
  [LICENSE-SDXL1.0 (source)](https://github.com/Stability-AI/generative-models/blob/HEAD/model_licenses/LICENSE-SDXL1.0);
  [Marigold LICENSE-MODEL.txt (source)](https://github.com/prs-eth/Marigold/blob/HEAD/LICENSE-MODEL.txt)
- **Stable Diffusion 3.5** is under the Stability AI Community License, described by Stability as covering users
  "with less than $1M in annual revenue" (search; the licence text was not read). —
  [stability.ai/license (search)](https://stability.ai/license)
- **FLUX.1 [dev]** (Non-Commercial License v1.1.1). On outputs: "You may use Output for any purpose (including for
  commercial purposes), except as expressly prohibited herein." On the model: "You may only access, use, Distribute,
  or create Derivatives of the FLUX.1 [dev] Model or Derivatives for Non-Commercial Purposes"; a Non-Commercial
  Purpose holds "only so far as you do not receive any direct or indirect payment arising from the use of the FLUX.1
  [dev] Model", and "use (a) for revenue-generating activity ... is not a Non-Commercial Purpose"; one may not use the
  model "or any data produced by the FLUX.1 [dev] Model ... for any commercial or production purposes"; "Derivative"
  covers "any customized or fine-tuned version". —
  [LICENSE-FLUX1-dev (source)](https://github.com/black-forest-labs/flux/blob/HEAD/model_licenses/LICENSE-FLUX1-dev)
- **FLUX.2**: [dev] and [klein] 9B are under FLUX non-commercial licences with the same clauses; **[klein] 4B and 4B
  Base are apache-2.0** (2026-01-15), with text-to-image and single- and multi-reference editing, and "Klein 4B fits
  in ~8GB VRAM (RTX 3090/4070 and up)". **FLUX.1 [schnell]** is Apache-2.0. —
  [FLUX.2 README (source)](https://github.com/black-forest-labs/flux2/blob/HEAD/README.md);
  [LICENSE-FLUX-DEV (source)](https://github.com/black-forest-labs/flux2/blob/HEAD/model_licenses/LICENSE-FLUX-DEV);
  [LICENSE-FLUX1-schnell (source)](https://github.com/black-forest-labs/flux/blob/HEAD/model_licenses/LICENSE-FLUX1-schnell)
- **Qwen-Image and Qwen-Image-Edit** (2025-08-18; 2509; 2511 on 2025-12-23): "Qwen-Image is licensed under Apache
  2.0"; the later Qwen Image 2.1 is under a "Qwen Research License" per StableGen's note. Fitting the 20B editor in
  24 GB needs a quantised build (community 4-bit builds claim "less than 20GB VRAM"; no 3090 timing found; search). —
  [Qwen-Image README (source)](https://github.com/QwenLM/Qwen-Image/blob/HEAD/README.md);
  [StableGen README (source)](https://github.com/sakalond/StableGen/blob/HEAD/README.md);
  [GGUF builds (search)](https://huggingface.co/unsloth/Qwen-Image-Edit-2511-GGUF)
- **Z-Image**: Apache-2.0 repository; Z-Image-Turbo released 2025-11-26; Z-Image-Edit "To be released" in the README
  at its last commit (2026-02-09). — [README (source)](https://github.com/Tongyi-MAI/Z-Image/blob/HEAD/README.md)
- **Tencent Hunyuan 3D 2.0 and 2.1 Community License**: "'Territory' shall mean the worldwide territory, excluding
  the territory of the European Union, United Kingdom and South Korea."; "You must not use, reproduce, modify,
  distribute, or display the Tencent Hunyuan 3D 2.1 Works, Output or results of the Tencent Hunyuan 3D 2.1 Works
  outside the Territory."; more than "1 million monthly active users" needs a licence; "Tencent claims no rights in
  Outputs You generate." The 2.0 text has the same clauses. —
  [2.1 LICENSE (source)](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/HEAD/LICENSE);
  [2.0 LICENSE (source)](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/HEAD/LICENSE)
- **IP-Adapter** (the image-prompt adapter in DiffusedTexture, StableGen and Paint3D) and **Wan2.1** (SeqTex's base)
  are Apache-2.0 repositories; **OminiControl** (OmniFabric's conditioning) is Apache-2.0 code whose subject LoRAs
  "were trained on FLUX.1-dev". —
  [IP-Adapter LICENSE (source)](https://github.com/tencent-ailab/IP-Adapter/blob/HEAD/LICENSE);
  [Wan2.1 LICENSE (source)](https://github.com/Wan-Video/Wan2.1/blob/HEAD/LICENSE.txt);
  [OminiControl README (source)](https://github.com/Yuanshi9815/OminiControl/blob/HEAD/README.md)

### Inferences

- **Safe bases for textures that ship**: SD 1.5, SD 2.1 and SDXL (their use restrictions don't touch game textures),
  FLUX.1-schnell, FLUX.2 [klein] 4B, the Apache releases of Qwen-Image and Qwen-Image-Edit, Z-Image-Turbo, TRELLIS.2.
  A LoRA or adapter adds its own licence and can only narrow its base's.
- **FLUX.1-dev, FLUX.2-dev and klein 9B are out**: making a sold game's assets is use of the model for a
  revenue-generating activity, whatever the outputs clause says. That removes OmniFabric, UniTEX and any FLUX-dev LoRA.
- **Hunyuan is out on territory alone**: a game on a worldwide storefront distributes the texture in the EU, the UK
  and South Korea. That removes Hunyuan3D-Paint 2.0 / 2.1, MaterialMVP, the Hunyuan delight model and, by
  inheritance, NI-Tex.
- None of the small models that §1 to §3 rely on (PBRify CC0, DeepBump's GPL tool, Marigold, StableDelight, SAM 2,
  BiRefNet) restricts commercial use of what it outputs. A logo or print lifted from a photo of a branded garment is
  still the brand's whatever the tool's licence: `cloth2tex.md` §6's rule stands for decals above all.

### Gaps

- The Stability AI Community License, the Qwen Research License and MiniMax-H3's licence were not read at source.
- The FLUX.1-dev clauses pull in opposite directions; the reading above is the cautious one and is not legal advice.

## 7. A non-AI, classical route for mapping a flat-lay or catalog photo onto garment panels

### Takeaway

Now a side question (ready-made garments bring their own textures), but the answer stands: no recent tool packages a
classical photo-to-panel warp, the published precedents are old and without usable code, the building blocks are all
permissive and current, and the one licence trap is the garment landmark detectors, whose weights are trained on
datasets released for non-commercial research.

### Cited Findings

- The closest published method: Majithia et al. (WACV 2022) "predict a sparse set of 2D landmarks on the boundary of
  the garments", use them "to perform Thin-Plate-Spline-based texture transfer on UV map panels", and "employ a deep
  texture inpainting network to fill the large holes"; no code release found (search). —
  [arXiv 2111.15140 (search)](https://arxiv.org/abs/2111.15140v1)
- Pix2Surf (CVPR 2020) gets correspondences without hand landmarks by "silhouette matching, correspondence extraction
  and texture map extraction" (non-commercial licence, SMPL); Cloth2Tex needed 10 to 12 clicked landmarks a photo. —
  [Pix2Surf README (source)](https://github.com/aymenmir1/pix2surf/blob/HEAD/README.md)
- **Thin-plate splines, ready-made**: scikit-image 0.24.0 (2024-06-18) added `skimage.transform.ThinPlateSplineTransform`
  (search); Kornia (Apache-2.0, last commit 2026-11-11) has `kornia/geometry/transform/thin_plate_spline.py`; small
  MIT implementations: py-thin-plate-spline, Moving-Least-Squares image deformation, pycpd (coherent point drift). —
  [scikit-image 0.24 notes (search)](https://scikit-image.org/docs/0.24.x/release_notes/release_0.24.html);
  [Kornia (source)](https://github.com/kornia/kornia/blob/HEAD/kornia/geometry/transform/thin_plate_spline.py);
  [py-thin-plate-spline (source)](https://github.com/cheind/py-thin-plate-spline);
  [Moving-Least-Squares (source)](https://github.com/Jarvis73/Moving-Least-Squares);
  [pycpd (source)](https://github.com/siavashk/pycpd)
- **Garment landmark detectors**: MMPose (Apache-2.0, last commit 2025-08-04) ships configs and downloadable
  checkpoints for DeepFashion and for DeepFashion2's categories (ResNet-50, 256 × 192; PCK@0.2 0.94 to 0.99 in the
  categories listed); an MIT HRNet implementation for DeepFashion2 exists (2021). —
  [MMPose DeepFashion2 models (source)](https://github.com/open-mmlab/mmpose/blob/HEAD/configs/fashion_2d_keypoint/topdown_heatmap/deepfashion2/res50_deepfashion2.md);
  [HRNet-for-Fashion-Landmark-Estimation (source)](https://github.com/svip-lab/HRNet-for-Fashion-Landmark-Estimation.PyTorch)
- **DeepFashion2**: 491K images from "commercial shopping stores and consumers", "A total of 294 landmarks covering 13
  categories"; no licence file; "You need fill in the form to get password for unzipping files". The DeepFashion
  family's agreements (search): "available for non-commercial research purposes only"; one version adds "any portion
  of derived data". —
  [DeepFashion2 README (source)](https://github.com/switchablenorms/DeepFashion2/blob/HEAD/README.md);
  [DeepFashion agreement (search)](https://mmlab.ie.cuhk.edu.hk/projects/DeepFashion/DeepFashionAgreement.pdf)
- **Try-off models** (a worn photo to a flat product picture) are all closed: TryOffDiff "Not available for
  commercial use, unless the FULL source code is open-sourced!" (SSPL); TEMU-VTOFF CC BY-NC 4.0; CatVTON CC BY-NC-SA
  4.0; TryOffAnyone unlicensed. —
  [TryOffDiff README (source)](https://github.com/rizavelioglu/tryoffdiff/blob/HEAD/README.md);
  [TEMU-VTOFF LICENSE (source)](https://github.com/davidelobba/TEMU-VTOFF/blob/HEAD/LICENSE);
  [CatVTON LICENSE (source)](https://github.com/Zheng-Chong/CatVTON/blob/HEAD/LICENSE)

### Inferences

- If photo-to-garment transfer is ever wanted on ready-made garments, their UV islands play the part the tailor's
  panels did: landmarks on our side come from the island outlines, on the photo side from clicks (minutes a garment)
  or from the cut-out's outline matched to the island's, and the warp is one call in scikit-image or Kornia or a few
  dozen lines of JavaScript, with no GPU.
- Depending on MMPose's fashion checkpoints for a sold game is the cautious "no": the code is Apache-2.0 but the
  weights derive from data released for non-commercial research.
- The warp's three limits each have a licence-clean helper from the sections above: baked light (Marigold-IID,
  StableDelight), unseen sides (a low-denoise SD pass over the bake), worn photos (an Apache-2.0 image editor first).

### Gaps

- DeepFashion2's own agreement (behind a form) was not read; no 2024 to 2026 classical panel-warp tool was found in
  two searches; OpenCV's and SciPy's thin-plate-spline routines were not verified at source.
