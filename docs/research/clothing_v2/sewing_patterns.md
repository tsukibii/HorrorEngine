# Sewing-pattern generators (2024 to 2026): what is released, and the draping step they all end at

Research date 2026-11-11. Background for the report, not a candidate route: the user has since said they would rather
have ready-made garments fitted to their bodies than generate clothing. Builds on
`docs/research/mhr_pipeline/clothing.md` (2026-10-21) and doesn't repeat it.

Network note. **Read at source** (shallow clones; licence files, READMEs, requirements, configs and the scripts named
below; nothing run; commit dates are the repos'): ChatGarment, GarmentCodeRC, ContourCraft-CG, ContourCraft, AIpparel,
DressCode, SewFormer, SewingLDM, Design2GarmentCode, GarmageNet, GarmageJigsaw, GarmentDiffusion, GarmentImage,
GarmentGPT, Garment Particles, the latent flow matching repo, ReWeaver, Panelformer, GarmentCode,
NvidiaWarp-GarmentCode, NVIDIA Warp, Newton, newton-assets, libuipc and its samples, Codim-IPC, ZOZO's Contact Solver,
and the page sources of Dress-1-to-3, DressWild and Image2Garment. **GitHub issues and GitHub's repository search**
were fetched. **Via search summary** (arxiv.org, the project pages, the proceedings and news sites could not be
opened): everything about a paper's text and every number from a paper. **huggingface.co is blocked** for fetching
and for git, so a licence that lives only on a model card is marked *unverified*. The session's search budget ran out
before two follow-ups (Gaps, §2).

## 1. Which generators are released, and can a commercial studio use them?

### Takeaway
Eleven generators have code out; ten of those have weights; **none is a clean yes for commercial use**. No weights
licence could be verified, three repos have no licence file at all, one is non-commercial, and wherever a 3D step is
documented it is non-commercial (GarmentCode's simulator) or paid (Maya with Qualoth, Style3D Studio); the rest stop
at a pattern file. What they generate is a **pattern or a set of GarmentCode parameters, never a finished garment**.

### Cited Findings
Ranked for a studio that sells its games (most usable first). "Unverified" = on the model hub, which couldn't be read.

| # | Method (venue) | Released; last commit | Code licence | Weights licence | VRAM | Output | Body assumed | Commercial use | Sources |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Design2GarmentCode (CVPR 2025) | code + fine-tuned weights (Google Drive); 2025-11-19 | MIT, "Copyright (c) 2025 Style3D" | none stated; base Qwen2-VL-2B-Instruct (unverified) | not stated; a 2B model, a few GB (my estimate) | GarmentCode design parameters, then a pattern JSON | GarmentCode's measurement file (made to measure) | **No as shipped**: needs an OpenAI key (GPT-4o by default, paid); weights unlicensed | [README](https://github.com/Style3D/design2garmentcode-impl/blob/main/README.md), [LICENSE](https://github.com/Style3D/design2garmentcode-impl/blob/main/LICENSE) |
| 2 | ChatGarment (CVPR 2025) | code + one checkpoint whose link is dead since 2026-10-24 (the mirror lacks the file, a user, 2026-11-06); 2025-08-07 | Apache-2.0 | none stated; base LLaVA-1.5-7B | "at least 15 GB" (a user's report) | GarmentCode design parameters, pattern JSON, then `_sim.obj` with UVs, no texture | GarmentCode's `mean_all`; sizes and poses fixed through SMPL | **No today**: weights can't be had or relied on; text and edit modes call GPT-4o | [LICENSE](https://github.com/biansy000/ChatGarment/blob/main/LICENSE), [install](https://github.com/biansy000/ChatGarment/blob/main/docs/Installation.md), [issue 30](https://github.com/biansy000/ChatGarment/issues/30), [issue 25](https://github.com/biansy000/ChatGarment/issues/25) |
| 3 | Garment Particles (SIGGRAPH 2026) | code + weights + data; 2026-08-20 | MIT | unverified | not stated | a draped **point cloud** (.ply) and pattern panels (.npz); no mesh | the dataset's bodies; no body input | **Unclear**; needs the GarmentCodeData-v2 download to run at all | [README](https://github.com/garment-particles/GarmentParticles/blob/main/README.md), [LICENSE](https://github.com/garment-particles/GarmentParticles/blob/main/LICENSE) |
| 4 | Latent flow matching of implicit fields, Cao et al. (SIGGRAPH 2026, venue via search summary) | test code + checkpoints (a university SharePoint); 2026-07-13 | MIT | none stated | not stated | pattern meshes and stitches, from an image or unconditioned | no body input | **Unclear** | [repo](https://github.com/Cao-Cong0/Learning-Sewing-Patterns-via-Latent-Flow-Matching-of-Implicit-Fields) |
| 5 | SewingLDM (ICCV 2025) | code + weights; 2025-08-16 (one commit) | Apache-2.0 | unverified | not stated | GarmentCode-format pattern JSON from text, two sketches and a body | PCA weights of GarmentCodeData's own body model | **Unclear** | [README](https://github.com/shengqiliu1/SewingLDM/blob/master/README.md), [script](https://github.com/shengqiliu1/SewingLDM/blob/master/scripts/dress_multimodal_condition.py) |
| 6 | AIpparel (CVPR 2025) | code + weights; 2025-07-06 | an MIT file carrying GarmentCode's copyright line | owner, 2025-04: data and model "planning" CC BY 4.0; card unverified; base LLaVA-1.5-7B | not stated; same base and precision as ChatGarment, about 15 GB (my estimate) | GarmentCode-format pattern JSON; "currently we don't do any postprocessing for the prediction" | none: image or text only | **Unclear** | [LICENCE](https://github.com/georgeNakayama/AIpparel-Code/blob/master/LICENCE), [issue 1](https://github.com/georgeNakayama/AIpparel-Code/issues/1), [issue 14](https://github.com/georgeNakayama/AIpparel-Code/issues/14), [inputs](https://github.com/georgeNakayama/AIpparel-Code/blob/master/assets/data_configs/inference_example.json) |
| 7 | GarmentGPT (ICLR 2026, venue via search summary) | inference code + weights; 2025-09-30 | README says Apache-2.0; no LICENSE file in the tree | unverified | not stated; its engine is set to take 90% of the card | GarmentCodeData-format JSON from one image | none | **Unclear** | [README](https://github.com/ChimerAI-MMLab/Garment-GPT/blob/main/README.md), [main.py](https://github.com/ChimerAI-MMLab/Garment-GPT/blob/main/main.py) |
| 8 | ReWeaver (CVPR 2026) | code + weights; 2026-06-23 | **no licence file** | unverified | not stated | 3D curves, patches and 2D panels (.npz) from 4 or more photos | none | **No** | [repo](https://github.com/SII-LiMing/ReWeaver-Code) |
| 9 | DressCode (SIGGRAPH 2024) | code + weights; 2024-10-07 | **no licence file** | unverified | not stated | pattern JSON and tile PBR maps; 3D only by Maya + Qualoth, "for *Windows* only" | SMPL's average female | **No** | [README](https://github.com/IHe-KaiI/DressCode/blob/main/README.md), [sim install](https://github.com/IHe-KaiI/DressCode/blob/main/docs/Installation.md) |
| 10 | SewFormer (SIGGRAPH Asia 2023) | code + weights; 2023-12-28 | **no licence file** | unverified | not stated | pattern JSON; 3D by Maya on Windows | SMPL | **No** | [repo](https://github.com/sail-sg/sewformer) |
| 11 | GarmageNet (SIGGRAPH Asia 2025) | code; **no weights**: "due to confidentiality policies at Style3D, we cannot release the pre-trained weights"; 2026-01-16 | CC BY-NC-ND 4.0 | withheld | n/a | geometry images per panel, sewn and finished through Style3D Studio | Style3D's size-S avatar in A-pose (via search summary) | **No** | [LICENSE](https://github.com/Style3D/garmagenet-impl/blob/main/LICENSE), [issue 2](https://github.com/Style3D/garmagenet-impl/issues/2), [GarmageJigsaw](https://github.com/Style3D/garmagejigsaw-impl/blob/main/README.md) |

- **Not released, so not candidates.** GarmentDiffusion (IJCAI 2025): the repo its page calls "Code" holds a README and
  the page — [repo](https://github.com/Shenfu-Research/GarmentDiffusion). GarmentImage (SIGGRAPH 2025): the
  representation's encode and decode scripts, no trained generator, no licence file —
  [repo](https://github.com/yukistavailable/GarmentImage). Dress-1-to-3: "Code (coming soon)", page unchanged since
  2025-05-28 — [page source](https://github.com/dress-1-to-3/dress-1-to-3.github.io/blob/main/index.html).
  Image2Garment: "Code (soon)" (2026-10-06) —
  [page source](https://github.com/image2garment/image2garment.github.io/blob/main/index.html). DressWild: no code
  link (2026-03-27) — [page source](https://github.com/dresswild/dresswild.github.io/blob/main/index.html).
  SwiftTailor (CVPR 2026): "Code (TBD)" (via search summary), and nothing in Qualcomm AI Research's GitHub —
  [project page](https://qualcomm-ai-research.github.io/SwiftTailor),
  [org search](https://github.com/orgs/Qualcomm-AI-research/repositories?q=tailor). Panelformer (WACV 2024): the
  "official implementation" is a licence and a readme — [repo](https://github.com/ericsujw/Panelformer). GitHub's
  search finds no repository for GarmentX, GarmentWeaver, NGL-Prompter or InverseDraping —
  [GarmentWeaver](https://github.com/search?q=GarmentWeaver&type=repositories),
  [NGL-Prompter](https://github.com/search?q=NGL-Prompter&type=repositories),
  [InverseDraping](https://github.com/search?q=InverseDraping&type=repositories),
  [GarmentX](https://github.com/search?q=GarmentX+garment&type=repositories).
- **Base models and paid calls.** ChatGarment and AIpparel fine-tune `liuhaotian/llava-v1.5-7b` —
  [ChatGarment script](https://github.com/biansy000/ChatGarment/blob/main/scripts/v1_5/evaluate_garment_v2_imggen_2step.sh),
  [AIpparel config](https://github.com/georgeNakayama/AIpparel-Code/blob/master/configs/aipparel_inference.yaml).
  LLaVA's notice puts its checkpoints under the "Llama community license" (LLaMA-2, Vicuna-v1.5) and OpenAI's terms
  for its data — [LLaVA README](https://github.com/haotian-liu/LLaVA/blob/main/README.md). ChatGarment's text and
  edit modes call OpenAI's `gpt-4o-2024-05-13`; its image mode doesn't —
  [textgen script](https://github.com/biansy000/ChatGarment/blob/main/scripts/evaluate_garment_v2_textgen_1float.py).
  Design2GarmentCode "defaults to *ChatGPT-4o*" and has `base_urls` and `model` fields —
  [README](https://github.com/Style3D/design2garmentcode-impl/blob/main/README.md),
  [system.json](https://github.com/Style3D/design2garmentcode-impl/blob/main/system.json).
- **The vocabulary is GarmentCode's.** The two parameter predictors choose among its fitted and plain shirts, two
  waistbands, eight bottoms (skirts and pants), seven necklines, turtle, lapel and hood collars, sleeves and three
  cuffs; ChatGarment's fork adds an open front. No pockets, buttons, zips, plackets, pleats or linings —
  [design_used.yaml](https://github.com/biansy000/GarmentCodeRC/blob/main/assets/design_params/design_used.yaml),
  [Design2GarmentCode's text space](https://github.com/Style3D/design2garmentcode-impl/blob/main/lmm_utils/core.py).
  GarmentCodeData's authors name hardware (zips, buttons, hooks) as outside it (via search summary) —
  [paper](https://arxiv.org/abs/2405.17609).
- **The maintainers on quality.** ChatGarment, to a user whose bishop sleeves, ruffles and waist ruching were lost:
  "It is hard for the model to generate garments with complex designs at high accuracy", "And it cannot generate
  textures" — [issue 26](https://github.com/biansy000/ChatGarment/issues/26). AIpparel: "Since our model is only
  trained on synthetic images, the performance on real images is limited" —
  [issue 21](https://github.com/georgeNakayama/AIpparel-Code/issues/21).
- **How often the patterns simulate** in GarmentCode's simulator, as a later paper measured them (third party, via
  search summary): ChatGarment 97.9%, Design2GarmentCode 87.1%, AIpparel 73.9%, SewingLDM 61.4% —
  [GarmentWeaver](https://arxiv.org/abs/2608.30550).
- **Bodies.** ChatGarment stitches on `body_name='mean_all'` with `smpl_body=False`; its size fix loads
  `SMPL_NEUTRAL.pkl` and a pose estimator's SMPL output; reposing is by skinning ("We use RobustSkinWeights") —
  [run_garmentcode_sim.py](https://github.com/biansy000/ChatGarment/blob/main/run_garmentcode_sim.py),
  [postprocess.py](https://github.com/biansy000/ChatGarment/blob/main/scripts/postprocess/postprocess.py),
  [issue 12](https://github.com/biansy000/ChatGarment/issues/12).

### Inferences
- They automate one decision: which design, from a picture or words. Only the two that predict GarmentCode
  *parameters* (rows 1, 2) keep its made-to-measure fit; the others emit panels at fixed sizes for their training
  bodies, so a different body means scaling by hand or hoping the drape forgives it.
- A 3090 is enough for all of them. Memory was never the obstacle; licences, the vocabulary and the drape are.

### Gaps
- Unverified: every weights licence in the table, Qwen2-VL-2B's licence, and GarmentCodeData's licence (the training
  data of most of them). Venues and all paper numbers are via search summary.
- EasyFashion (arXiv 2609.18483), Textile IR (arXiv 2601.02792) and SewFusion (arXiv 2609.23548) surfaced and were not
  looked into. Nothing was run: no VRAM or time is measured.

## 2. The draping step in November 2026, and what changes in the earlier note

### Takeaway
Every released generator still stops at or before the step this studio removed, and those that go on to 3D use a
tool it can't ship with: GarmentCode's simulator is unchanged and non-commercial. The earlier note's conclusion
stands. Three of its
statements need correcting: ContourCraft-CG is not a way to sew patterns; Newton has left beta but its XPBD solver has
no cloth self-collision; and two Apache-2.0 solvers with real stitch constraints (ZOZO's, libuipc) were missed. None
of the commercially usable solvers is a pattern-to-garment pipeline, and nobody claims unattended robustness.

### Cited Findings
- **GarmentCode's simulator: no change.** Last commit 2024-09-02; "The Work and any derivative works thereof only may
  be used or intended for use non-commercially ... for research or evaluation purposes only"; a request for a
  commercial licence (2026-08-13) has no reply —
  [LICENSE.md](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode/blob/main/LICENSE.md),
  [issue 4](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode/issues/4). Upstream Warp is Apache-2.0, at
  1.19.0 (2026-11-02), and has removed `warp.sim` ("superseded by the Newton library") —
  [Warp CHANGELOG](https://github.com/NVIDIA/warp/blob/main/CHANGELOG.md).
- **Those that go to 3D call it.** ChatGarment's `run_garmentcode_sim.py` runs `pygarment.meshgen.simulation.run_sim`,
  and its GarmentCodeRC says "We use our own version of the NVIDIA warp simulator"; Design2GarmentCode and the latent
  flow matching repo name the same fork, SewingLDM and AIpparel's owner point to GarmentCode —
  [run_garmentcode_sim.py](https://github.com/biansy000/ChatGarment/blob/main/run_garmentcode_sim.py),
  [GarmentCodeRC install](https://github.com/biansy000/GarmentCodeRC/blob/main/docs/Installation.md),
  [Design2GarmentCode README](https://github.com/Style3D/design2garmentcode-impl/blob/main/README.md),
  [SewingLDM README](https://github.com/shengqiliu1/SewingLDM/blob/master/README.md),
  [AIpparel issue 21](https://github.com/georgeNakayama/AIpparel-Code/issues/21).
- **Correction: ContourCraft-CG doesn't sew.** Its example loads garments already draped by that simulator
  (`..._sim.obj`) with registered SMPL-X parameters, for motion; installing ContourCraft needs the SMPL-X files; its
  trained models come with no licence statement —
  [simulation_example.py](https://github.com/biansy000/ContourCraft-CG/blob/main/simulation_example.py),
  [INSTALL.md](https://github.com/Dolorousrtur/ContourCraft/blob/main/INSTALL.md).
- **Newton** (Apache-2.0): 1.0.0 on 2026-03-10, 1.7.0 on 2026-10-14. Its feature table: XPBD cloth "no
  self-collision"; the Style3D solver, cloth yes; VBD, cloth yes but "experimental". The Style3D helper takes a welded
  3D mesh plus each triangle's 2D panel coordinates, which is the form of GarmentCode's box mesh; a sew-by-distance
  helper exists in its source but isn't exported —
  [CHANGELOG](https://github.com/newton-physics/newton/blob/main/CHANGELOG.md),
  [solver table](https://github.com/newton-physics/newton/blob/main/docs/solvers/index.rst),
  [example](https://github.com/newton-physics/newton/blob/main/newton/examples/cloth/example_cloth_style3d.py),
  [cloth.py](https://github.com/newton-physics/newton/blob/main/newton/_src/solvers/style3d/cloth.py).
- **ZOZO's Contact Solver** (not in the earlier note): "Apache 2.0 allows commercial and proprietary use" (its Blender
  add-on is GPL-3.0-or-later); "100% Penetration-Free Upon Success", a strict strain limit, "Fabric presets match real
  measurements"; runs natively on Linux with an NVIDIA card ("3090 / 4070 / 5070 for small to medium" scenes);
  stitches are a first-class asset; its `fitting` example sews a stitched dress onto a moving
  body mesh (28.5K vertices, 240 frames, 1.26 minutes on an NVIDIA L4); the Blender add-on (2026-04-30) has "Snap and
  Merge" to "sew a garment panel to a body"; a start from an overlapping pose was added in late September 2026 and
  "does not untangle the overlap". Its author: "Should we use it? Honestly, not yet for serious use" —
  [README](https://github.com/st-tech/ppf-contact-solver/blob/main/README.md),
  [LICENSING.md](https://github.com/st-tech/ppf-contact-solver/blob/main/LICENSING.md),
  [fitting.ipynb](https://github.com/st-tech/ppf-contact-solver/blob/main/examples/fitting.ipynb),
  [snap and merge](https://github.com/st-tech/ppf-contact-solver/blob/main/docs/blender_addon/workflow/constraints/snap_merge.md),
  [issue 152](https://github.com/st-tech/ppf-contact-solver/issues/152).
- **libuipc** (Apache-2.0, `pip install pyuipc`, CUDA, still v0.0.x): a "Soft Vertex Stitch" joins vertex pairs of two
  meshes; its samples include `24_sewing_pattern`, two panels of a top stitched round a body mesh. Codim-IPC
  (Apache-2.0, last commit 2022) has the stitched-garment example ZOZO reuses —
  [README](https://github.com/spiriMirror/libuipc/blob/main/README.md),
  [stitch](https://github.com/spiriMirror/libuipc/blob/main/docs/specification/constitutions/soft_vertex_stitch.md),
  [sample](https://github.com/spiriMirror/libuipc-samples/blob/main/examples/24_sewing_pattern/main.py),
  [Codim-IPC](https://github.com/ipc-sim/Codim-IPC).
- **Failure and time, as authors report them** (via search summary unless linked): GarmentCodeData kept about 72% of
  sampled designs, 44 hours of draping per 5,000 on an RTX 3090 (about 32 s each, my arithmetic); ChatGarment on an
  A100: 12.1 s for the model, 3.5 s for the pattern, 33.9 s for stitching; Style3D's own automatic panel placement
  starts 68% of garments with no user help (no code found) — [GarmentCodeData](https://arxiv.org/abs/2405.17609),
  [ChatGarment](https://arxiv.org/abs/2412.17811), [Liu et al. 2024](https://wanghmin.github.io/publication/liu-2024-adg).
  GarmentCode's gates, at source: 2,400 steps or 600 s, at most 35 body and 300 self collisions —
  [default_sim_props.yaml](https://github.com/maria-korosteleva/GarmentCode/blob/main/assets/Sim_props/default_sim_props.yaml).
- Blender 5.2 LTS (2026-07-14) adds experimental node-based cloth on an XPBD solver (via search summary) —
  [CG Channel](https://www.cgchannel.com/2026/07/blender-5-2-lts-is-here-discover-its-5-key-features/).

### Inferences
- **What to change in the earlier note.** Withdraw "ContourCraft-CG is the strongest learned option ... so MHR
  works". Replace "port GarmentCode's XPBD changes to Newton, a few hundred lines" with: Newton's XPBD lacks cloth
  self-collision, so a port would sit on its Style3D solver (which already takes the box mesh's form) or the
  experimental VBD. Add ZOZO's solver and libuipc beside Blender as commercially usable ways to sew panels.
- **What doesn't change.** GarmentCode's own drape can't make shipped assets; nothing found turns a pattern into a
  garment on an arbitrary body without a success-rate filter and retries; the result is still a single-layer shell
  that needs thickness, closures and detail added.

### Gaps
- Nothing was run. Whether any of these solvers drapes a pattern on an MHR body better than what the studio removed
  is unknown; ZOZO's author warns against serious use.
- Not searched (budget ran out): arXiv 2509.05030 (draping beyond SMPL-like bodies) and garment refitting methods
  for non-SMPL characters. Blender 5.2's cloth nodes were not read at source.

## 3. Does anything here beat a library of ready-made garments for a one-person studio?

### Takeaway
No. Every method in this slice stops at a sewing pattern or a list of GarmentCode parameters, and a pattern is the
cheap half of a garment: it still has to be draped on the body (the step this studio built, judged bad and removed),
given thickness, closures and construction detail by hand, and weighted. The designs they can express are GarmentCode's
basics (no pockets, buttons, zips, plackets, pleats or linings), their own maintainers say complex designs are lost,
between 2% and 39% of their patterns don't even simulate (a later paper's count), none has weights under a licence
that could be verified, and the 3D tools they document are non-commercial or paid. A garment that a person already
designed, with real construction detail, fitted to an MHR body is ahead of all of this before any of it runs, and
MHR's single topology should make fitting such a garment to every character a one-time binding rather than a new
simulation each time (the earlier note's §2, an inference there too). The only things here worth carrying forward
are background: a garment's flat panels are its
natural UV layout (the tailor already lays its fabric that way), and three commercially usable solvers now exist
(ZOZO's, libuipc, Newton's Style3D solver) that could settle a ready-made garment on a changed body if a plain
morph ever looks wrong, which is untested.

### Cited Findings
- The facts this rests on are cited above: output types and licences (the table), the vocabulary and the maintainers'
  statements (§1), simulation success and the drape tools (§1, §2).
- Industrial patterns do exist as data, but not for this use: GarmageSet has 14,801 professionally made garments under
  CC BY-NC-ND 4.0 (via search summary), and the model trained on it is withheld —
  [dataset card](https://huggingface.co/datasets/Style3D/GarmageSet),
  [issue 2](https://github.com/Style3D/garmagenet-impl/issues/2).

### Inferences
- If a reference picture should ever pick a design automatically, the transferable idea is the cheap one: a
  vision-language model choosing values in a fixed list of named parameters. That could point at any parametric
  wardrobe, the studio's own included, and needs none of these repos or their weights.

### Gaps
- Ready-made garments and how to fit them belong to another note; nothing about them was researched here.
