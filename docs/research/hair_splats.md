# Hair as a Gaussian splat: research note (2026-10-22)

The user's question: could a head of hair be captured as a Gaussian splat from a 360° video, the background and the
head taken away, the splat fitted to a character's head, and then bent in clumps by a few bendy bones, with no physics,
"just the equivalent of image manipulation"?

What was read: the repositories' licence files and READMEs (raw.githubusercontent.com was reachable), search summaries
of the papers and plugin pages. arxiv.org, github.io project pages and semanticscholar.org were blocked from the
session (DNS), so the papers are from their abstracts and third-party summaries. **[guess]** marks my own estimates.

Context in the repo: hair today is procedural cards with a verlet wig (`hair.js`, `wig.js`), Perm strands batched into
clumps with one guide chain each (`hair_batch.py`, `strands.js`, a Kajiya-Kay shader), and since today any hair mesh
worn as a wig with a particle cage (`wigify.js`). The Character Studio runs three.js r160. docs/research/hair.md says
why strands and proper shading are the next jump in looks.

---

## 1. Capture

**A wig on a stand first, a person later.** A real person can't hold still for the minute or two a 360° pass takes;
breathing and small head turns blur the ends and break the camera solve. A wig on a styrofoam or mannequin head is
still, can be lit at leisure and recaptured. Gaussian Haircut, the one released method built for this, also expects a
static subject and a moving phone, "with as little motion blur as possible" (its README).

**Two ways to go round:**

- **Walk round a still head** (lights fixed in the room): the classic capture. Three rings, at eye level, about 40°
  above and about 20° below (the underside of long hair and the nape), 60 to 100 frames each.
- **A turntable with the phone on a tripod** (lights fixed to the camera): easier in a small room. The background must
  be masked for the camera solve (it doesn't move, the head does). The light then turns with the camera, so the splat
  bakes "lit from the viewer's side": wrong for a lamp or the moon, but close to what a player's own flashlight does
  **[guess, worth a look in the first test]**.

**Frames:** 150 to 300 sharp ones. Record 4K at 30 fps, lock exposure, focus and white balance (no HDR, no beauty
filter), a fast shutter, then keep the sharpest frame of every 5 to 10 (ffmpeg plus a Laplacian-variance pick).

**Light:** soft and even, two big softboxes or a white tent with the ceiling bounced; no hard key, no window sun. Even
light is what makes the splat's colours closest to the hair's own colour, which matters for section 6.

**Help the solve:** hair is the worst surface for structure-from-motion (fine, repetitive, shiny). Give it texture
that doesn't move with the light: a printed pattern or ArUco board on the stand's base or turntable, marks on the
stand's neck.

**Camera poses:**

| Tool | What | Licence, accounts |
|---|---|---|
| COLMAP (with masks, sequential matching for video) | the standard solve; GLOMAP's global mapper now lives inside it ("global" mapper), one to two orders faster than incremental | BSD; no account. The separate GLOMAP repo is deprecated |
| VGGT (Meta, CVPR 2025) | poses straight from the frames, no matching | the code is commercial-friendly since July 2025, but the commercial checkpoint needs an application form (an account); the original checkpoint is non-commercial and downloadable |
| MASt3R / DUSt3R (Naver) | pose-free reconstruction | CC BY-NC-SA 4.0 |

COLMAP is the right first try; VGGT or MASt3R only if COLMAP fails on the hair.

**Training on the 3090:** 30k iterations on 200 frames at 1 to 2 megapixels is 10 to 30 minutes for any of these, well
inside 24 GB **[guess, typical figures]**.

| Trainer | Licence | Notes |
|---|---|---|
| Original 3DGS (Inria, graphdeco) | **non-commercial**: "for research and/or evaluation purposes only", derivatives must keep the restriction | the reference; Gaussian Haircut is built on it |
| gsplat (nerfstudio) | Apache 2.0 | CUDA, the best kept library; `simple_trainer.py` has per-pixel masks (ignored in the loss), `random_bkgd`, MCMC densification and an anti-aliased mode |
| nerfstudio splatfacto | Apache 2.0 | gsplat behind nerfstudio's tooling |
| Brush (Arthur Brussee) | Apache 2.0 | Rust, WebGPU through Burn, Linux and any GPU, a CLI and a live viewer; **trains on images with transparency** (the splat is forced to match the alpha) or a `masks` folder; reads COLMAP or nerfstudio data; calls itself a proof of concept |
| OpenSplat | AGPL-3.0 | portable C++; the copyleft is harmless for us but nothing it adds over gsplat |

Recommended: **Brush** for the first test (one binary, alpha training built in), **gsplat** when we need to change the
training (the head holdout below, per-Gaussian labels). Train with anti-aliasing on: the hair will be seen small
(section 6), and thin needle Gaussians sparkle at a distance without it.

## 2. Keeping only the hair

**Masks:**

- **SAM 2** (Meta, Apache 2.0 code and checkpoints, plain download): one click on the hair in the first frame and its
  video predictor tracks it round the whole turn. The best tool for a consistent hair mask across 360°.
- **BiRefNet** (MIT): a sharp foreground matte, good for "the person or the stand against the background", with soft
  edges.
- **MediaPipe's hair segmenter** (already used by `hair_match.py`): 512 px, coarse; good enough to vote with, not for
  edges.

**Train with masks, or delete afterwards?** Both, in this order:

1. **Train the whole head** (hair, face or stand) against a background-only matte, with alpha supervision (Brush's
   RGBA input, or gsplat with a random background). Training only on a hair mask fails: in front views the back hair
   sits behind the face, the mask says "nothing here", and the training makes the back hair transparent. Gaussian
   Haircut does the same: it trains the full scene first.
2. **Label every Gaussian by the hair masks:** each one's contribution to hair and non-hair pixels summed over all
   views, the winner kept (FlashSplat, ECCV 2024, solves this in closed form without retraining; a simple vote of each
   centre projected into every view, depth-tested, is enough for a first try).
3. **Delete what's inside or on the head:** a head fitted to the splat (section 3), every Gaussian within a few
   millimetres of it or inside it removed. Gaussian Haircut's `filter_flame_intersections.py` is this step with FLAME.

**What's left on the scalp side:** nothing. The inner surface of the hair (towards the scalp) was never seen, so the
splat is a shell open on the inside. On the character the head fills it, as it does for cards: the scalp under the
splat wants a hair-coloured tint (the parting line too, where the capture saw foam or lace). Looking up under long
hair (a ghost from below) will show thin, never-seen hair **[guess]**.

**Edges:** the finest strands carry the backdrop's colour into the splat (a halo). A soft matte reduces it; a neutral
grey or dark backdrop makes what's left less visible in a dark game.

## 3. Fitting the splat to the character's head

The splat is in the solve's own units and frame. Three steps:

1. **Landmarks:** MediaPipe's Face Landmarker on the frames where the face shows (a person, or most mannequin faces),
   each landmark triangulated across those views with the solved cameras: a 3D landmark set in the splat's frame. The
   Character Studio's MHR head already knows where MediaPipe's landmarks sit on it (`face_mesh.py` bends the head to
   them), so the pairs are free.
2. **A similarity transform** (Umeyama: scale, rotation, translation) from those pairs. The face's own size sets the
   scale, which the camera solve alone can't.
3. **Refine and bend:** ICP of the splat's innermost hair Gaussians against the crown, then `wigify.js`'s fit (the
   crown band, the six handles, Gaussians inside the head pushed out). A different skull shape needs a smooth bend, not
   only a scale: the same per-point offsets `wigify.js` gives its vertices, applied to the Gaussian centres.

A FLAME fit (what Gaussian Haircut and GaussianAvatars use) does the same job with a full head model, but FLAME's
licence and download need an account at MPI, and MHR is already our head. No FLAME needed.

## 4. Bending without physics

**The maths is small.** A Gaussian is a centre, a rotation, three scales, an opacity and a colour. To move it with
bones: the centre by linear blend skinning (or dual quaternions), the covariance turned by the blended rotation
(Σ' = A Σ Aᵀ, A the blended matrix's linear part). Spark already does this (`SplatSkinning`, "experimental": dual
quaternion or linear blend, up to 4 bones per splat, up to 256 bones per mesh, in its GPU pipeline).

**"Bendy bones":** Blender's B-bones bend a mesh along a Bézier segment, which is what the user means; but Unreal has
no B-bones (a B-bone rig is baked to ordinary bones on export). The equivalent that works everywhere:

- **A chain per clump:** 4 to 8 ordinary bones down each clump, weights smoothed along the chain and across to the
  neighbouring clumps so the clumps don't tear apart. This is `hair_batch.py`'s idea exactly, and the wig's chains
  (`wig.js`, exported for Unreal as bones) can drive a splat as well as strands.
- **Or curve-driven:** each Gaussian stores its clump, its distance down the clump and its offset in the clump's frame;
  each frame the clump's joints become a smooth curve with a rotation-minimising frame, and every Gaussian is placed on
  it. No candy-wrapper pinching, cheap in a shader, the closest thing to a B-bone.

**Clumps from a splat:** a splat has no strands, so a clump is found from positions and directions: hair Gaussians are
long and thin, their long axis runs along the hair. k-means on (place on the scalp, direction), or columns round the
head by angle, each parameterised by distance from the crown.

**"No physics":** the chains are then moved by hand-made motion: a sway, a lag behind the head's turn, a tilt with
gravity. That is a spring on each bone's angle, which is a few lines and what Unreal's AnimDynamics or Kawaii Physics
do; `wig.js` already does more.

**What research has done with hair Gaussians:**

| Work | What | Code, licence |
|---|---|---|
| Gaussian Haircut (Zakharov et al., ECCV 2024) | a phone video of a still head to strands: a full 3DGS first, then strand-aligned Gaussians fitted to it, with FLAME, orientation maps and a hairstyle diffusion prior; strands out as PLY or pickle | released; **CC BY-NC-SA 4.0 plus the Inria 3DGS licence** (non-commercial). CUDA 11.8, conda, OpenPose (CMU, non-commercial), PIXIE and FLAME data from Google Drive (no sign-up, but MPI's research-only terms), SAM, GroundingDINO, Blender 3.6. "A few hours" on one GPU per the project; 11 h strands, 15 h end to end on an RTX A4500 per CGHair's table |
| GaussianHair (Luo et al., 2024) | each strand a chain of thin cylindrical Gaussians, from handheld video, with a hair scattering model for relighting and editing | no code found |
| HairGS (Pan, Nießner, Kirschstein, BMVC 2025) | multi-view images to strands: Gaussian segments merged into strands, then grown; "typically within one hour" | project page; code not confirmed |
| CGHair (Luo et al., CVPR 2026) | strands clustered into hair cards with shared Gaussian texture codebooks: 200× less memory, 4× faster than Gaussian Haircut | project page; code not confirmed |
| EfficientMonoHair (CVPR 2026) | fast strands from monocular video | code not confirmed |
| HADES (ICCV 2025) | strands bound to Gaussians, roots on an avatar, dynamic hair | code not confirmed |
| 3DGStrands (Computers & Graphics, 2025) | a strand-organised Gaussian hair simulated with the material point method | code not confirmed |
| GaussianAvatars (Qian et al., CVPR 2024), MeGA (CVPR 2025) | Gaussians bound to FLAME triangles; MeGA keeps the hair as its own Gaussians, moved rigidly plus a learned deformation | GaussianAvatars CC BY-NC-SA 4.0, needs FLAME |
| Skinning of Gaussian avatars (Moverse, 2025) | linear blend skinning of Gaussian centres with averaged quaternions for the rotations: engine-portable | article; method only |

**Strands or splats?** The research has moved to strands: plain 3DGS hair is "numerous uncontrollable and disconnected
Gaussians" (HairGS), and every hair paper since 2024 uses the splat only as the go-between from video to strands. For
us the strand route (video, then Gaussian Haircut, then strands into `hair_batch.py`'s clumps, then a groom for
Unreal) fits everything already built: the clumps, the chains, `strands.js`'s shading, Unreal's groom with its own
lighting, shadows and binding. The splat route keeps the photographed look but has none of that. Gaussian Haircut's
weight (a day to set up, half a day to run, research-only pieces) is the price.

## 5. Showing it

**In the browser:**

- **Spark** (World Labs, MIT, active, v2.4): a splat renderer inside three.js; all splats in a scene sorted together
  (a GPU distance readback, a bucket sort in a worker, the order one frame behind), merged with opaque meshes by the
  depth buffer, per-splat editing on the GPU, `SplatSkinning`. Budget "1 to 5 million splats" on a computer; a head of
  hair is 0.2 to 1 million **[guess]**. **It needs three.js 0.180 or newer**; the studio is on r160, so either the
  vendored three.js is upgraded (every page to recheck) or the splat lives on its own test page first. Vendor it
  locally, no CDN.
- **GaussianSplats3D** (mkkellogg, MIT): the README says it is no longer in active development and points to Spark.
  CPU (WASM) sort, artefacts on fast turns, no skinning.

**In Unreal 5.8:** Epic has no built-in splat rendering (5.7 and 5.8 notes have none). The plugins:

| Plugin | Licence | Notes |
|---|---|---|
| XV3DGS (XVERSE) | Apache 2.0, free | Niagara-based; notes go up to UE 5.4 |
| SplatRenderer (Dazai Studio) | Apache 2.0, free | UE 5.5+, **Windows only**; static 3DGS and 4DGS sequences, Sequencer |
| YaGS (Yandex) | Apache 2.0, free, source | UE 5.5 to 5.7, Windows, depth compositing with meshes; a code drop, no roadmap |
| NanoGS (Tim Chen) | MIT, free | UE 5.6 and 5.7, Nanite-style clusters and a GPU radix sort; "proof of concept" |
| WallGS / WallGS Pro (Walhar Gohar) | paid on Fab (from $49.99; Pro 7 Oct 2026) | Pro adds relighting (generated normals, a blend of captured and scene light), Lumen screen-traced reflections |
| Volinga, XGrids LCC, GSX Shadows | commercial | 4D playback, shadow casting |

**None skins a splat to a skeleton.** All target static scenes or baked 4D sequences, most are Windows/DX12 builds
(our Unreal is Linux on Vulkan; the source-available ones might compile, untested). A bent hair splat in Unreal means
writing it ourselves: a Niagara system whose particles carry their bone weights and read the head's and the hair
chains' transforms from the skeletal mesh each frame (Niagara's skeletal mesh data interface does that on the GPU),
the covariance turned in the sprite's material. A week or two of engine work with real unknowns (sorting against other
translucency, shadows, Lumen) **[guess]**.

## 6. The big catch: light

**A splat carries the light it was captured under.** Its colours (and the spherical harmonics on top) are what the
camera saw, not what the hair is. Under the game's warm lamp, moonlight or a flashlight it stays lit like the capture
room: glowing in the dark, shadows in the wrong places.

What can be done:

- **Relightable Gaussian methods** need either a light stage (Meta's Relightable Gaussian Codec Avatars; GroomLight,
  CVPR 2025, an extended hair BSDF plus a learned residual, no code found) or a decomposition into albedo, roughness
  and normals from one lighting (R3DG, GS-IR and their 2026 successors), which assumes surfaces: hair has no normal,
  only a direction. GaussianHair's scattering model is the closest fit, without code. **For a phone capture of hair:
  no released method relights it properly.**
- **Re-shading, the practical way** **[guess, but standard]:** capture under flat even light, drop the view-dependent
  spherical harmonics, treat the remaining colour as the hair's colour, and shade each Gaussian ourselves with
  Kajiya-Kay, using its long axis as the strand direction (the shader `strands.js` already has), plus a darkening by
  depth into the hair volume for self-shadowing. Spark's per-splat GPU pipeline (`dyno`) can do it in the browser;
  WallGS Pro's normals and blend are a paid version of the same idea in Unreal. It won't match a groom's deep shadows,
  but it makes the hair answer to a lamp and a flashlight.
- **The flashlight coincidence:** a turntable capture with the light beside the camera bakes "lit from the eye", which
  is what a player's own torch does (section 1). Worth one comparison in the first test, not a plan.

**Sorting:** the body and clothes are opaque, so the depth buffer handles them; splats from all characters sort
together in Spark. Other translucent things (eyelashes as cards, glass, fog sprites) don't sort with splats and will
cut through them wrongly. In Unreal, translucent Niagara sprites sort within their own system and composite after the
opaque pass: hair over a translucent window would be wrong.

**From the player's eye:** at the medium shot (1.2 m, the 90° lens on a 16:9 frame, 59° up and down) a head of hair
about 0.28 m wide is about 220 pixels wide at 1080p, 300 at 1440p; at MCU (0.7 m) about 380 at 1080p. The capture has
far more detail than that; what shows is the silhouette, the colour variation, the flyaways and the light. Splats do
the first three better than anything we have. The fourth is the catch above. Fast turns can show the one-frame sort lag
as flicker in thin hair **[guess]**.

## 7. Licences and privacy

Everything above runs locally with no account and no telemetry, except where noted:

- **Permissive (could even ship in a sold game):** COLMAP (BSD), gsplat, nerfstudio, Brush (Apache 2.0), SAM 2 code
  and checkpoints (Apache 2.0), BiRefNet (MIT), MediaPipe (Apache 2.0), Spark and GaussianSplats3D (MIT), XV3DGS,
  SplatRenderer, YaGS (Apache 2.0), NanoGS (MIT). OpenSplat is AGPL-3.0 (fine as a tool).
- **Non-commercial (fine for the free games, DECISIONS 2026-10-22):** the original Inria 3DGS; Gaussian Haircut
  (CC BY-NC-SA 4.0 plus Inria's); OpenPose (CMU); PIXIE, FLAME and SMPL-X data (MPI research licences, which normally
  sit behind an MPI sign-up; Gaussian Haircut's script fetches copies from Google Drive, so the terms apply even with no
  sign-up: the user's call); GaussianAvatars, MASt3R (CC BY-NC-SA 4.0); VGGT's original checkpoint.
- **Needs an account, so out:** VGGT's commercial checkpoint (an application form), FLAME's own site, Postshot and
  the other hosted capture apps (Luma, Polycam, KIRI and the like upload the video).
- **Privacy:** a capture of a real person is their likeness. The video, frames and splat stay in
  `Content/Studio/People/<name>/` (git-ignored), with their agreement. A wig on a stand has no such question.

## Verdict

**Can it work?** The capture-to-bent-splat chain works with free, permissive, local tools: Brush or gsplat to train,
SAM 2 to mask, our own landmarks for the fit, Spark to show and skin it in the browser. Nothing in it is research. The
two parts that don't work yet are **light** (a phone capture can't be properly relit; re-shading is an approximation)
and **Unreal** (no plugin bends a splat by bones, most are Windows-only; we'd write it).

**How good compared with what we have?** In the Character Studio, under light like the capture's: clearly better than
the cards and very likely better than the Perm strands, because it is the real hair's silhouette, colour and
flyaways. Under the game's lamp, moon and torch: only as good as the re-shading, probably still better than the cards,
comparable to `strands.js` **[guess]**. In Unreal: a groom (strands, from Gaussian Haircut, Perm or Sisir) beats a
splat, because Unreal lights, shadows and binds grooms itself.

**Days to a first test:** 1 to 2 days (a capture, a solve, a training, a crop, a page). A bent splat on an MHR head
in the browser, re-shaded under the studio's four lights: another 5 to 8 days. A bent splat in Unreal on Linux: 1 to 2
weeks more, uncertain. The strand route instead: 1 to 2 days to install Gaussian Haircut, half a day per run, 2 to 3
days into `hair_batch.py` and an Alembic groom.

**The recommended route:** splat as the capture, strands for the game. Capture and train a splat (permissive tools)
for its look and as the ground truth; use it in the browser where it shines (the Character Studio preview, the
reference a groom must match); for Unreal, turn the same capture into strands with Gaussian Haircut (non-commercial,
acceptable for the free games) and send them through the clumps and chains we already have. Bend a splat in Unreal
only if the first tests show the re-shaded splat beats the groom in a POV medium shot, which is the user's call.

**The first test:** a wig on a stand, a 360° walk-round in soft light (three rings, 200 frames), COLMAP, Brush with
the background matted out (BiRefNet), the head cut away with SAM 2's hair masks, then one standalone page with Spark:
the hair splat over the MHR head, scaled by hand, seen from the POV at MS 1.2 m and MCU 0.7 m beside the current cards
and Perm strands, under the studio light and a flashlight. If it reads clearly better there, do the fit (section 3)
and the chains (section 4) next.

## Sources

- Original 3D Gaussian Splatting, licence: https://github.com/graphdeco-inria/gaussian-splatting/blob/main/LICENSE.md
- gsplat (Apache 2.0, `examples/simple_trainer.py`): https://github.com/nerfstudio-project/gsplat
- nerfstudio (Apache 2.0): https://github.com/nerfstudio-project/nerfstudio
- Brush (Apache 2.0, README on masks and alpha): https://github.com/ArthurBrussee/brush ; https://radiancefields.com/brush-0-2-released
- OpenSplat (AGPL-3.0): https://github.com/pierotofy/OpenSplat
- COLMAP: https://github.com/colmap/colmap ; GLOMAP (deprecated, merged into COLMAP): https://github.com/colmap/glomap
- VGGT licence and checkpoints: https://github.com/facebookresearch/vggt ; MASt3R (CC BY-NC-SA 4.0): https://github.com/naver/mast3r
- SAM 2 (Apache 2.0): https://github.com/facebookresearch/sam2 ; BiRefNet (MIT): https://github.com/ZhengPeng7/BiRefNet
- MediaPipe hair segmenter: https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite
- FlashSplat (ECCV 2024): https://eccv2024.ecva.net/virtual/2024/poster/180 ; Gaussian Grouping: https://arxiv.org/abs/2312.00732 ; SAGA: https://arxiv.org/abs/2312.00860
- Gaussian Haircut, paper: https://ecva.net/papers/eccv_2024/papers_ECCV/html/2505_ECCV_2024_paper.php ; code, README, `install.sh`, `run.sh`: https://github.com/eth-ait/GaussianHaircut ; MPI page: https://is.mpg.de/ps/projects/human-hair-reconstruction-with-strand-aligned-3d-gaussians
- GaussianHair (arXiv 2402.10483): https://arxiv.org/abs/2402.10483
- HairGS (BMVC 2025): https://arxiv.org/abs/2509.07774 ; https://bmvc2025.bmva.org/proceedings/1220/
- CGHair (CVPR 2026): https://openaccess.thecvf.com/content/CVPR2026/html/Luo_CGHair_Compact_Gaussian_Hair_Reconstruction_with_Card_Clustering_CVPR_2026_paper.html ; https://arxiv.org/abs/2604.03716
- EfficientMonoHair (CVPR 2026): https://arxiv.org/abs/2604.05794
- HADES (ICCV 2025): https://openaccess.thecvf.com/content/ICCV2025/papers/Liao_HADES_Human_Avatar_with_Dynamic_Explicit_Hair_Strands_ICCV_2025_paper.pdf
- 3DGStrands (Computers & Graphics 2025): https://www.sciencedirect.com/science/article/pii/S0097849325001025
- GroomLight (CVPR 2025): https://openaccess.thecvf.com/content/CVPR2025/html/Zheng_GroomLight_Hybrid_Inverse_Rendering_for_Relightable_Human_Hair_Appearance_Modeling_CVPR_2025_paper.html
- Relightable Gaussian Codec Avatars: https://arxiv.org/abs/2312.03704
- GaussianAvatars (CC BY-NC-SA 4.0): https://github.com/ShenhanQian/GaussianAvatars ; MeGA (CVPR 2025): https://github.com/conallwang/MeGA ; HairCUP: https://arxiv.org/abs/2507.19481
- On the skinning of Gaussian avatars (Moverse): https://research.moverse.ai/articles/skinned-gaussian-avatars/skinned-gaussian-avatars.html ; SplattingAvatar: https://initialneil.github.io/SplattingAvatar
- Spark (MIT; system design, `SplatSkinning.ts`, performance notes, three >= 0.180): https://github.com/sparkjsdev/spark
- GaussianSplats3D (MIT, no longer in active development): https://github.com/mkkellogg/GaussianSplats3D
- XV3DGS (Apache 2.0): https://github.com/xverse-engine/XV3DGS-UEPlugin
- SplatRenderer (Apache 2.0, Windows): https://github.com/DazaiStudio/SplatRenderer-UEPlugin
- YaGS: https://radiancefields.com/yags-yandex-open-sources-a-3dgs-plugin-for-unreal-engine-5.5%E2%80%935.7
- NanoGS (MIT): https://github.com/TimChen1383/NanoGaussianSplatting ; https://www.cgchannel.com/2026/03/free-plugin-nanogs-puts-nanite-style-gaussian-splatting-in-unreal-engine/
- WallGS Pro: https://radiancefields.com/wallgs-pro-brings-gaussian-splat-relighting-to-unreal-engine-5 ; https://forums.unrealengine.com/t/walhar-gohar-wallgs-pro-gaussian-splat-renderer/2838653
- Unreal and splats in 2026: https://blog.4dpipeline.com/unreal-engine-and-gaussian-splatting-what-production-teams-need-to-know-in-2026 ; https://forums.unrealengine.com/t/official-support-for-gaussian-splat-rendering/1767323
