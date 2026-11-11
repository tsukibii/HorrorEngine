# Cloth2Tex, read at source level: could it be a CloV2 tab?

Research date 2026-11-11. The user's ask: "Evaluate and determine whether we could upgrade our clothing system with
[Cloth2Tex] ... instead of replacing it we'd simply add a new cloV2 tab, if we could use this how much vram etc would it
require to run the repo, I know the repo doesn't give us phase 2 (fine textures) but I'm ok using our existing textures +
pbrs".

How it was read: the repo shallow-cloned (`HumanAIGC/Cloth2Tex`, commit `8c75480`, 2023-12-01, its only commit) and
every file of phase 1 read; its shipped results and template meshes opened and measured; its issues read on GitHub.
Network note: arxiv.org and the project page (tomguluson92.github.io) were blocked in this session, so nothing here
comes from the paper's text; the README, the code and the issues are the sources. **Nothing was run**: there is no
graphics card in the session, so the memory figures below are worked out from the code's tensor sizes, not measured.

## 1. Takeaway

**No. It isn't a clothing system, and what it makes isn't what the ask assumes.**

- Cloth2Tex doesn't make garments. It ships **nine fixed garment meshes** made by hand, and its whole output is a
  **texture** for one of them: two catalog photos (front and back) pulled onto that mesh's UV map. The mesh it deforms
  on the way is only a registration aid shaped like the photo, not a garment fitted to anyone.
- So "its garments with our textures and PBR sets" keeps nothing of Cloth2Tex but those nine meshes, which are GPL-3.0
  (not CC0, not ours: they can't ship in a game), aren't fitted to MHR, and would need everything the tailor already
  does for its own garments (fit to each body, layers, the hang, creases, skin weights, the skin hidden under them).
- And "its texture on our garments" needs our garments rebuilt as its templates (see §4), for a **512 × 512** texture
  with holes down every side seam, which is exactly what its unreleased phase 2 exists to repair.
- Memory is not the obstacle: **about 2 GB of VRAM** (estimate), a twelfth of the 3090.
- The repo is abandoned: one commit, phase 2 never released, the landmark detector and the automatic scaling held
  back on purpose, and the three questions that matter to us (own template mesh, putting the clothes on an avatar,
  phase 2's date) unanswered since 2024.

What is worth keeping is the **idea**: a garment's look taken from photos of a real one. Our garments make that far
easier than Cloth2Tex's route does (§5).

## 2. What it is

- Two phases; "We only made **Phase I** publicly available for now" (README). Phase 1 registers a template mesh onto
  the two photos and makes a coarse texture; phase 2 (an image translation network trained on textures synthesised with
  a latent diffusion model) completes it. Phase 2: "We are applying for the open-source of Phase II" (README,
  2023-12); asked for a date in 2024, the only reply is another user's "Seems that they forgot about it"
  ([issue 8](https://github.com/HumanAIGC/Cloth2Tex/issues/8)).
- Phase 1 as the code does it (`phase1_inference.py`, `models/deform_model.py`, `lib/deformation_graph.py`,
  `renderer/cloth_renderer.py`):
  1. the template is centred and scaled to a unit box, then slid up or down until its neckline landmark meets the
     photo's (401 steps, no gradients);
  2. an **embedded deformation graph** (about one node per twenty vertices, by quadric decimation; each vertex follows
     its nine nearest nodes) is optimised for 1,001 Adam steps so the mesh's front and back **silhouettes** (PyTorch3D's
     soft silhouette renderer, two orthographic views) match the photos' masks and its landmark vertices land on the
     photos' landmarks, held together by as-rigid-as-possible, normal and edge terms;
  3. a **512 × 512 × 3 texture** (a plain tensor, started white) is optimised for 1,001 Adam steps so the textured
     mesh rendered from the front and the back matches the two photos (L1 plus total variation).
- The result is `<n>_texture_uv_1000.jpg`: that texture, in the template's own UV layout. "Users can check it with
  Blender" is where the README stops.

## 3. What's in the repo, and what isn't

| | |
|---|---|
| Templates | nine: `1_wy` (sweatshirt), `2_Polo`, `3_Tshirt`, `4_shorts`, `5_trousers`, `6_zipup`, `7_windcoat`, `9_jacket`, `11_skirt`; a `10_dress` folder of photos has no mesh and no entry in the code |
| Their meshes | 6,116 (skirt) to 9,881 (wind coat) vertices, 11.8k to 18.2k triangles; single-layer shells as a pattern tool's drape leaves them, the body taken away; one UV per vertex (front and back islands); **each in its own space and scale** (the trousers 0.60 units tall, the zip-up sitting at y 1.6 to 2.4): not metres on any body, the code normalises them |
| Hardcoded per template | the landmark names in order, **the vertex number of every landmark** on that mesh, front and back (`vertex_number_dict`), the vertex count, a scale for its test photos |
| Inputs per garment | `bg/<n>_1.jpg` and `_2.jpg` (front and back, 512 × 512), `mask/` the same as masks, `square/<n>_1.json` and `_2.json`: 10 to 12 landmarks each as **labelme** points (neck left and right, hem left and right, shoulders, both ends of each cuff...) |
| Not released | the 2D landmark detector ("We are not going to release the 2D landmark detector ... annotate it manually or train a simple 2D cloth landmark detector"), the automatic scaling ("self-implement it or manually adjust the `--s`"), whatever made the masks (a folder is named `mask_F3Net`), phase 2 |
| Licence | **GPL-3.0** for the repo, its template meshes included. The reference photos are product shots of real garments |
| State | one commit (2023-12-01); five open issues, none answered by the authors: [how to use my own template mesh](https://github.com/HumanAIGC/Cloth2Tex/issues/6), [how to put cloth on avatar](https://github.com/HumanAIGC/Cloth2Tex/issues/7), [phase II's date](https://github.com/HumanAIGC/Cloth2Tex/issues/8) |

## 4. What a run needs

**Software** (README): Python 3.8, PyTorch 1.13, CUDA 11.7, pytorch3d, psbody-mesh (built against Boost),
torch_geometric with `pyg_lib`, `torch_cluster`, `torch_scatter`, `torch_sparse` wheels for exactly that PyTorch, and
Kaolin. Read against the code: Kaolin is never imported (one function was copied from it), and phase 1 only touches
torch_geometric's base package. It is all three years old; a 3090 still runs cu117 wheels, but psbody-mesh and the
pinned wheels are the kind of install that takes an afternoon on Arch. `.cuda()` is written everywhere: no CPU path.

**VRAM** (estimated from the tensors the code makes; not measured):

| What | Size |
|---|---|
| ResNeXt-50 and VGG-16 loaded "for a perceptual loss" that is then set to 0 and never called | 0.10 + 0.55 = 0.65 GB of weights doing nothing |
| The soft silhouette pass: 2 views × 512 × 512 pixels × 10 faces a pixel (face ids, depths, barycentrics, distances) | 0.15 GB a call, twice a step, plus the blend's temporaries and the gradients: under 0.5 GB |
| The texture pass (1 face a pixel), the 512 × 512 texture and its optimiser, the mesh and the graph | under 0.05 GB |
| CUDA's own context and the allocator's slack | about 0.5 to 1 GB |
| **Total** | **about 2 GB** (about 1.3 GB with the two unused networks deleted) |

A 4 GB card would run it. Raising its 512 px to 2,048 px (it would have to be, for the texture to be of use: §5)
multiplies the render buffers by 16: 5 to 7 GB, still a third of the 3090.

**Time**: 2,403 optimiser steps a garment (401 + 1,001 + 1,001), each two small renders: minutes, not hours (not
measured).

**By hand, for every garment**: a front and a back photo squared to 512 px, a mask of each, 10 to 12 landmarks
clicked on each in labelme, and `--s` tried until the mesh covers the photo.

## 5. What comes out, judged from the results the repo ships

`experiments/20231017_wy`, `_jk` and `_trousers` are the authors' own phase 1 outputs.

- The texture is **512 × 512 for the whole garment**, front and back side by side: about 3 mm a texel on a sweatshirt.
  Our fabrics are drawn at their threads' size (TAILOR §1b, §1e); a 512 px picture can carry a garment's panels, pockets
  and fades, not its cloth.
- **Holes down every seam.** Only two views are ever rendered, straight from the front and the back, so the sides, the
  underarms and the inseams are seen edge-on or not at all: in the trousers' UV they are grey-white smears down both
  edges of each leg, and the sweatshirt rendered back shows torn black and white fringes along its sides and cuffs.
  Phase 2 is the part that paints these in.
- The photo's own light and wrinkles are baked into the colour.

## 6. Against the tailor

| | Cloth2Tex | The tailor (docs/TAILOR.md) |
|---|---|---|
| A garment's shape | one of nine hand-made meshes, under 10k vertices, the same for everyone | cut from each character's own body, 25k to 165k triangles, 86 designs, edited by its cut lines |
| Fitting a body | none: "how to put cloth on avatar?" has no answer | by construction, on any MHR body, again when the body changes |
| Layers, the hang, creases, thickness, details | none | all there |
| In motion | nothing (no weights, no skeleton) | weights from the body, skin under the clothes left out of the export |
| The look | a 512 px picture from two photos | fabrics at real size, PBR sets off the shelf, patterns, up to six prints a garment |

To put its texture on **our** garments instead, each of ours would have to become a template it accepts: under 10k
vertices with one UV a vertex, and a list of landmark vertex numbers picked by hand, when our garment meshes are made
again on every body and every edit, so those numbers never hold still. We do know where a garment's neck, shoulders,
cuffs and hem are (the cut lines: `tailor/guides.js`), so the landmarks could be made rather than picked; but then we
would be maintaining a fork of a dead GPL repo on a 2022 PyTorch stack to get a 512 px texture with holes.

**What the idea is worth to us, and the cheaper way to it.** Cloth2Tex needs a 3D mesh bent through a renderer because
its templates have no flat form. Ours do: every tailor garment already has **fabric coordinates in metres laid as sewn
panels** (a front and a back panel for the torso, a sleeve round its arm, a leg round its line: `tailor/uv.js`). A
flat-lay or catalog photo of a garment is, near enough, those panels seen flat. So a garment's look from photos is, for
us, a **2D warp** of each photo onto its panel (outline to outline, the landmarks ours for free on our side), baked
where the prints are baked (`albedo.js`), at whatever resolution the photo has, with the fabric's weave, normal and
roughness still coming from the shelf's set under it, which is the user's "our existing textures + PBRs". No renderer,
no PyTorch, no VRAM. Its limits are the same as any photo's: the sides between the two views have to be filled, and
the photo's light is in it. Whether that is worth building is weighed against the newer options in the report beside
this note.

**One rule to keep in view** (CLAUDE.md: assets are CC0 or ours): a shop's product photo is the shop's, and the
garment's print or logo its brand's. Photos for this have to be the user's own, of plain or own-design clothes.

## 7. Verdict

Not as a CloV2 tab, and not as a base to build one on. Nothing of it would ship (GPL meshes), nothing of it fits MHR,
the part that makes its output usable was never released, and the one thing it does for us (a photo's look on a
garment) is simpler to do on our own panels than through it.
