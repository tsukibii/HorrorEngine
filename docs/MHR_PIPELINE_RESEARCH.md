# MHR can replace MetaHuman except close-up faces

Yes: one person and an AI assistant can realistically build a character system on Meta's MHR that matches or beats MetaHuman for this studio everywhere except the speaking face seen from inside half a metre, which is the shot a first-person horror romance leans on hardest. Most of what makes MetaHumans look good belongs to Unreal, not to MetaHuman: refractive eye shading, Burley subsurface skin, strand grooms that bind to any skeletal mesh and Chaos Cloth all work on an MHR mesh, and MHR itself (Apache-2.0) imports cleanly, keeps its 72 FACS expression shapes exact under any identity, and is the body Kimodo's SOMA skeleton was built to drive ([MHR](https://github.com/facebookresearch/MHR); [SOMA-X](https://github.com/NVlabs/SOMA-X)). What cannot be rebuilt in months is MetaHuman's face rig, counted at **870 joints, 263 expression controls and 82 animated wrinkle masks**, with combinations that deviate from a linear sum by up to 16.6 mm ([QtMeshEditor PR #1104](https://github.com/fernandotonon/QtMeshEditor/pull/1104)), together with the identity-aware solver and scan-synthesised skin behind it; MHR offers 72 linear shapes, and our solve would be MediaPipe for the eyes plus Audio2Face-3D for the lips. Expect MHR faces to read as convincing at medium close-up and wider, close to MetaHuman in still or slow close-ups once eyes and skin are done well, and visibly behind in extreme close-ups of speech and strong expression. Nobody has published a side-by-side, so the user's own takes must measure that gap. The recommended architecture is **MHR-first**: one design in the desk, compiled locally and automatically into every character, with MetaHuman kept only as an optional branch for hero faces if the measurement demands it. That inverts the 2026-10-20 decision that MetaHuman makes every final character. The local Claude's tool list points the right way but needs two swaps and five fixes; the most consequential are that ComfyUI's ARKit-to-MHR table sends blinks to the look-down shape, and that Audio2Face-3D runs locally on Linux only through its SDK, not its Unreal plugin. Outside the list, GarmentCode's own draping simulator is licensed for research only.

## MHR already does the body half better than MetaHuman can

MetaHuman in UE 5.8 is far more open than the version the project first planned around:
- Creator has run on Linux since 5.7, and MetaHuman Animator's facial solve has run on Linux since 5.8.
- Full-body Mesh to MetaHuman now conforms head and body together from any topology.
- The rig runtime was released as MIT-licensed OpenRigLogic.

([MetaHuman 5.7](https://www.metahuman.com/releases/metahuman-5-7-is-now-available); [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine); [OpenRigLogic](https://github.com/EpicGames/OpenRigLogic))

The restrictions the user feels are still real. **Auto-rigging and skin texture synthesis run in Epic's cloud, behind an Epic login and a consent step** ([Epic docs](https://dev.epicgames.com/documentation/metahuman/getting-started-with-metahuman-creator-in-unreal-engine?lang=en-US); [Epic forum](https://forums.unrealengine.com/t/error-not-logged-in-5-6/2542895)). On 5.8.1, one user reproduced on two accounts a Full Rig job that stalled at 75% and failed after a 300 s timeout; Joints Only rigs on the same machine took 153–198 s ([Epic forum](https://forums.unrealengine.com/t/metahuman-full-rig-autorig-status-poll-with-waitseconds-10-hangs-for-300s-and-fails-with-server-error-5-8-1-reproduced-across-two-accounts/2741256)). Creator's sculpting stays inside realistic human ranges ([Epic forum](https://forums.unrealengine.com/t/does-metahuman-support-stylized-characters/213339)). OpenRigLogic's MIT licence covers only the libraries: "a MetaHuman character created in UE 5.8 remains subject to the Unreal Engine EULA terms" ([OpenRigLogic issue #1](https://github.com/EpicGames/OpenRigLogic/issues/1)). A cloud job that can time out has no place inside the desk's Generate button, which the user wants to deliver a previewable game "with no Claude in between" ([DECISIONS](../docs/DECISIONS.md)).

MHR has none of those limits. Measured on its v1.0.1 release files, it imports into Unreal cleanly:
- centimetres, Y-up with +Z front, and unit scale;
- no scale on any joint, and the bind pose equals the rest pose;
- each joint's X axis runs along its bone, with at most four skin influences per vertex;
- 127 joints, one UV set, and 117 sparse blendshapes, of which the last 72 are the published FACS expressions.

([MHR v1.0.1 release](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1); [face-expressions.md](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md))

Two things need cleaning before import. The file carries **77 "Collision N" null nodes parented under joints**, which Unreal's FBX importer has historically turned into bones ([bf-gamedev, 2014](https://lists.blender.org/pipermail/bf-gamedev/2014-July/000275.html)). It also has no FBX BindPose node, which should only cause a warning because bind equals rest. PyMomentum's FBX writer can leave the collision geometry out ([momentum](https://github.com/facebookresearch/momentum/blob/main/pymomentum/geometry/geometry_pybind.cpp)). Avoid the official web viewer's GLB export, because it writes no morph targets ([web-viewer exporters](https://github.com/facebookresearch/MHR/blob/main/web-viewer/exporters.py)). The project has also already learned that Unreal's glTF import scaled MHR's bones but not its vertices ([LESSONS](../docs/LESSONS.md)).

What makes a character compiler simple is how MHR combines identity and expression. Its forward pass applies identity and expression coefficients together as one linear blend on a single template ([mhr.py](https://github.com/facebookresearch/MHR/blob/main/mhr/mhr.py)). So **expressions do not depend on identity, and identity never moves the joints**. Measured, no identity shape changes height by more than 0.48 cm; height and limb proportions live in 68 separate scale parameters ([MHR v1.0.1 release](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1); [SOMA-X mhr2soma.py](https://github.com/NVlabs/SOMA-X/blob/main/tools/mhr2soma.py)).

Baking a cast member therefore means taking the template plus the identity deltas plus the face fitter's photo bend as the new rest mesh, and keeping the 72 expression deltas unchanged. That is exactly how MHR animates every identity, not an approximation of it. The exception is the photo bend, which can move eyelids and lips beyond MHR's identity space. So every character gets a measured check:
- close both eyes and measure the gap between the lids;
- open the jaw, press and suck the lips, and test for self-intersection.

MHR also ships barycentric mappings from LOD1 to LODs 0 and 2–6 ([LOD conversion](https://github.com/facebookresearch/MHR/tree/main/tools/mhr_LOD_conversion)). One character built at LOD1 therefore yields a seven-level chain with the same identity at every level.

Body animation is the easiest part of the whole system. NVIDIA's SOMA-X lists MHR as its "default high-fidelity body backend" ([SOMA-X](https://github.com/NVlabs/SOMA-X)), and the SOMA paper drives every supported body from one skeleton with no model-specific retargeting ([arXiv 2603.16858](https://arxiv.org/abs/2603.16858)). The desk already maps all 77 Kimodo joints onto every MHR bone, twist bones and fingers included ([ANIMATION](../docs/ANIMATION.md)).

The plan is to port that mapping to Python and bake Kimodo motions offline into FBX animations on the MHR skeleton. This skips Unreal's IK Retargeter, which would otherwise leave MHR's procedural twist joints and extra foot joints at rest. The project treats the desk's blocking as the reference the Unreal build must match ([CLAUDE.md](../CLAUDE.md)). With MHR characters in both places, the bodies match by construction instead of through a retarget.

What MHR loses on the way into Unreal is its pose correctives. They come from a sparse network: 750 rotation features feed 3,000 ReLU units, which weight 3,000 corrective blendshapes. These shapes are added in rest space before skinning, the same space in which Unreal applies morph targets ([io.py](https://github.com/facebookresearch/MHR/blob/main/mhr/io.py)). How much they matter:
- **Test rotations:** a 90° rotation about a single axis moves skin by up to 47 mm at the shoulder and 86 mm at the hip. These are upper bounds, because some test rotations are not anatomical ([MHR v1.0.1 release](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)).
- **Real poses:** a third party found plain linear skinning **3–5 mm off full MHR on average**, worst at the shoulders and feet ([mimic-blender-sam3d](https://github.com/saranunt-0/mimic-blender-sam3d)).

That is invisible in wide or fast shots, and shows as collapsing shoulders and hips in a slow, close shot. Two fixes:
- **Cheap:** 10–20 correctives sampled from MHR at key poses, driven by Unreal's Pose Driver ([Pose Driver](https://docs.unrealengine.com/4.27/en-US/AnimatingObjects/SkeletalMeshAnimation/AnimPose/PoseDriverNode)).
- **Closer:** ML Deformer's Neural Morph Model trained on MHR's own output, if its training runs in the Linux editor ([ML Deformer](https://dev.epicgames.com/documentation/en-us/unreal-engine/ml-deformer-framework-in-unreal-engine)).

MHR also has no breast, belly, glute or hair bones. The soft-bone chains prototyped on the desk therefore get added before export and driven by Kawaii Physics, which is MIT-licensed and supports UE 5.3–5.8 ([KawaiiPhysics](https://github.com/pafuhana1213/KawaiiPhysics)).

For faces, the project's face fitter and body editor already cover photo references: they bend a whole MHR head or body to MediaPipe landmarks from a front and a side picture. Bodies from photos are possible too. Meta's SAM 3D Body recovers MHR shape and scale parameters from a single image ([sam-3d-body](https://github.com/facebookresearch/sam-3d-body); [SAM License](https://raw.githubusercontent.com/facebookresearch/sam-3d-body/main/LICENSE)):
- its licence has no non-commercial restriction but forbids reverse engineering;
- its weights come from Hugging Face after an access request, which means creating an account.

No other free base does better for this project:
- SMPL-X forbids commercial use ([SMPL-X licence](https://github.com/vchoutas/smplx/blob/main/LICENSE)).
- Character Creator 5 is Windows-only ([CC5 requirements](https://manual.reallusion.com/Character-Creator-5/Content/ENU/5.0/04-Introducing-the-User-Interface/System-Requirements.htm)).
- NAVER's Anny (Apache-2.0 code on CC0 MakeHuman data, with SOMA support since v0.5) is a credible fallback, but it brings nothing MHR lacks here ([Anny](https://github.com/naver/anny)).

One fact ties the whole system together: every cast member is the same MHR mesh in a different shape, with the same topology, UVs and skeleton. So every expensive per-character job collapses into a one-time job on the base mesh:
- groom bindings;
- garment body labels and masks for skin covered by clothing;
- face-part fitting templates;
- corrective shapes;
- curve mappings.

That is MetaHuman's own archetype trick rebuilt on an Apache-2.0 mesh, and it is what makes a one-person system plausible.

## The close-up face is the moat: 72 linear shapes against 870 joints

The gap that matters sits inside the face rig. Counted from Epic's SKM_Face.dna, a MetaHuman face has 870 joints, 263 CTRL_expressions controls and 82 animated wrinkle masks. When that face is baked down to linear ARKit-named shapes, its combinations break measurably ([QtMeshEditor PR #1104](https://github.com/fernandotonon/QtMeshEditor/pull/1104)):
- jaw plus smile deviates by 4.2 mm;
- funnel plus jaw plus brow deviates by 3.3 mm;
- pucker plus jaw deviates by 16.6 mm, "clearly nonlinear".

RigLogic turns those controls into joint motion, corrective vertex displacement at LOD 0, and wrinkle triggers in the material ([Epic: MetaHuman DNA](https://dev.epicgames.com/documentation/metahuman/metahuman-dna-rig-definition-and-rig-operation?lang=en-US)). MHR's face is 72 artist-sculpted, sparse FACS shapes summed linearly, with no combination or corrective shapes ([face-expressions.md](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md); [mhr.py](https://github.com/facebookresearch/MHR/blob/main/mhr/mhr.py)). MetaHuman's combinations are tuned to how real faces move, so a purely linear rig should expect misses of the same order on combined speech shapes.

Converting those misses to pixels shows why shot size decides everything:
- In a 1080p extreme close-up, a 15 cm face fills a 1,920 px frame, so every centimetre covers about 128 px. The 4.2 mm jaw-and-smile deviation is then about 54 px at the worst vertex.
- When the face is a quarter as wide on screen, the same deviation is about 13 px.
- Pucker with the jaw open, which rounded vowels produce mid-sentence, is the worst case: over 200 px in an extreme close-up.

Part of that gap can be closed on MHR's side, and the shared mesh means the work carries over to every cast member:
- **Combination correctives driven from curves.** Unreal's experimental RigMapper has a Multiply feature that a survey of the 5.8 source calls "the corrective-combination primitive" ([ARKitRemap: RigMapper notes](https://github.com/Dylanyz/ARKitRemap/blob/main/reference/rigmapper.md)). That lets curves drive corrective shapes such as jaw-times-pucker.
- **The corrective shapes themselves.** Sculpted once on the MHR base head as deltas, they apply to every cast member the way MHR's own expressions do.
- **Wrinkle masks.** A few masks for the forehead, crow's feet, brow furrow and nasolabial fold can follow the matching MHR curves in the skin material.

That amounts to a small RigLogic built by hand: a handful of combinations instead of 263 controls, and a few painted wrinkles instead of 82 scanned ones. It narrows the worst cases without erasing the gap. For a hero extreme close-up, a simple Control Rig with 72 float controls lets the user hand-key the frames that matter.

### Eyes, mouth and skin can be built from open parts

The second gap is hardware, and it is entirely buildable. MHR's head is a **single sealed shell with no eye or mouth openings** ([MHR v1.0.1 release](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)):
- Its `l_eye`, `r_eye`, `c_teeth` and `c_tongue0–4` joints have no skinned vertices at all.
- Gaze and blinks are surface shapes of under a centimetre: `eyesClosed_L` moves at most 0.96 cm.
- The jaw opens mainly through the `jawDrop` shape, which moves up to 3.97 cm.

A close-up needs real eyeballs, lids that close over them, a tear line, eye occlusion, teeth, gums, a tongue and a dark mouth interior. Two permissive sets cover nearly all of it:
- **USC's ICT-FaceKit (MIT)** ships eyeballs, lacrimal fluid, an eye blend mesh, eye occlusion, eyelash strips, 32 teeth, gums, a tongue and a mouth socket. Its eye geometry "adopts the style of Unreal Engine's Digital Human Project" and is "plug and play with Unreal Engine's shaders", but it comes without textures ([ICT-FaceKit](https://github.com/ICT-VGL/ICT-FaceKit)).
- **Google's GNM Head (Apache-2.0 code and weights, July 2026)** adds articulated upper and lower teeth with gums, an articulated tongue, UDIM UVs and shipped textures. It has no occlusion or tear line ([GNM](https://github.com/google/GNM); [GNM shape README](https://raw.githubusercontent.com/google/GNM/main/gnm/shape/README.md)).

The strictly CC0 options, MakeHuman/MPFB2's eyes and teeth and Blender Studio's eye and jaw base meshes, work at game-asset fidelity ([MPFB2 asset licence](https://raw.githubusercontent.com/makehumancommunity/mpfb2/master/LICENSE.ASSETS.md)). FLAME is out because its classic versions are non-commercial ([FLAME licence](https://flame.is.tue.mpg.de/modellicense.html)).

Fitting the parts is a deterministic headless-Blender script, but it takes more than parenting meshes to joints. In order, it:
1. Cuts the eye and mouth openings along the lid and lip contours that the face fitter already maps to MHR vertices.
2. Fits a sphere to each cut lid loop to place the eyeball, and weights the eyeball fully to its eye joint.
3. Shrinkwraps the lid margins onto the eyeball and corrects the blink and squint shapes, which were sculpted on a sealed eye.
4. Binds the thin strips that hug the skin (eye occlusion, tear line, mouth-bag rim) with Surface Deform, and bakes one shape per MHR expression so the strips follow every expression ([Blender: Surface Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html)).
5. Places the teeth by landmarks, with the upper teeth on `c_head` and the lower on `c_teeth`.
6. Weights the tongue along `c_tongue0–4`.
7. Blends the mouth bag's weights between `c_head` and `c_jaw`.

Eyelid follow, the lids riding slightly with the gaze, exists nowhere in MHR. It has to be added as correctives driven by eye rotation, as commercial rigs do ([Convai MetaHuman guide](https://docs.convai.com/api-docs/plugins-and-integrations/web-plugins/convai-web-sdk/lipsync-and-blendshape/metahuman-limit-drivers-required-for-mha)). The script ends the way the project checks everything: it measures lid-through-eyeball and lip-through-teeth penetration for every expression, and renders a contact sheet of eyes and mouths.

Shading is not a gap. The Eye shading model, Substrate's Eye BSDF, and the Subsurface Profile with Burley scattering and dual-lobe specular are engine features any mesh can use ([Epic: shading models](https://dev.epicgames.com/documentation/en-us/unreal-engine/shading-models-in-unreal-engine); [Epic: Subsurface Profile](https://dev.epicgames.com/documentation/unreal-engine/using-a-subsurface-profile-in-your-unreal-engine-materials)). Epic's advice for eyes is to reuse its Digital Humans eye material and swap the textures, one more reason to take ICT's Digital-Human-style eyeballs.

Skin *content*, the textures themselves, is the open-ended part. No CC0 scanned face texture exists. The only licence-clean scan found is Lee Perry-Smith's 2010 head under CC BY 3.0 ([licence](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/LeePerrySmith/LeePerrySmith_License.txt)). MetaHuman, by contrast, synthesises skin in the cloud and bakes maps up to 8K ([Epic: MetaHuman textures](https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures)).

The realistic route is to project the user's own photo references onto MHR's UVs, which are better than expected ([MHR v1.0.1 release](https://github.com/facebookresearch/MHR/releases/tag/v1.0.1)):
- one 0–1 tile;
- a face-centred head unwrap in the top-left quadrant, with no seam across the face;
- the head gets 23.4% of the UV area for 6.8% of the surface.

Remapped into its own head-only texture, a 4K map gives about 106 px/cm. That is close to the 128 px/cm a 1080p extreme close-up shows, with a tiling micro-normal carrying the pores. Output at 1440p or 4K wants an 8K map.

The recipe follows FFHQ-UV's: project each photo onto the fitted mesh, mask out what isn't skin, and blend the front and sides ([FFHQ-UV](https://github.com/csbhr/FFHQ-UV)). For our heads:
1. Solve each photo's camera from the landmark correspondences the fitter already has.
2. Divide out low-frequency shading. Marigold-IID can help, but its output is only about 768 px, which suits the shading estimate better than the final albedo ([Marigold](https://github.com/prs-eth/Marigold)).
3. Fill areas no photo sees from a tileable CC0 base.

Capturing the references in flat, diffuse light does more for the result than any de-lighting model. One practical snag: the face fitter's template, `MHR_head.obj`, has no UVs, so the bake must re-attach them by vertex index from the FBX.

## Lips from audio, eyes from video: face mocap that suits AI takes

The takes set a ceiling before any solver runs. MetaHuman Animator's mono-video guidance asks for HD or 4K at 60 fps in flat light ([Epic: capture guidelines](https://dev.epicgames.com/documentation/metahuman/metahuman-animator-video-capture-guidelines-in-unreal-engine)). The user's takes are AI-generated close-ups whose lip motion was invented by the video model, so tracking their mouths copies that model's mistakes. The robust design splits the face by region:
- **From the video:** brows, lids, blinks, gaze, cheeks, nose and head.
- **From the audio:** jaw, lips and tongue.
- **Emotional mouth corners:** whichever is larger, the audio value or a scaled video value.
- **During silences:** the video mouth returns, so breaths and held expressions survive.

MediaPipe's Face Landmarker is the right tracker for the upper face and the wrong one for the lips:
- It returns a neutral score plus 51 ARKit-named shapes, with no tongueOut ([MediaPipe blendshape graph](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/face_landmarker/face_blendshapes_graph.cc)).
- It runs every frame independently, with no temporal filter ([ComfyUI port](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/mediapipe/face_landmarker.py)).
- Practitioners report cheekPuff, jawForward, jawLeft, jawRight and the dimples "practically always" near zero ([DroidKaigi 2026](https://2026.droidkaigi.jp/en/timetable/1236039/)).
- jawOpen saturates near 1.0, while eyes rarely pass 0.5 and brows sit around 0.1–0.3 ([ComfyUI node docs](https://docs.comfy.org/built-in-nodes/SAM3DBody_FaceExpression)).
- Left and right refer to the subject's face, so mirrored input swaps them ([Google: Face Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)).

Each take therefore needs a neutral baseline, per-channel gains, and smoothing. The smoothing should be zero-phase, which the offline clips allow, and must leave blinks alone. ComfyUI's default seven-frame Gaussian spans 0.23–0.29 s at 24–30 fps, a whole blink, and flattens it ([ComfyUI face_expression.py](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/sam3d_body/face_expression.py)).

NVIDIA's Audio2Face-3D is the strongest licence-clean lip source, but only through its SDK. The SDK is MIT-licensed and runs on Linux. It outputs skin and tongue vertex positions, jaw anchor points and eye rotations, and offers an optional blendshape solve whose sample rig is ARKit-52 with tongueOut ([Audio2Face-3D SDK](https://github.com/NVIDIA/Audio2Face-3D-SDK); [SDK docs](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/docs/README.md)). The Unreal plugin is no use on this machine: running it locally needs Windows, and builds exist only for UE 5.4–5.6 ([ACE plugin docs](https://docs.nvidia.com/ace/ace-unreal-plugin/2.5/ace-unreal-plugin-audio2face.html); [NVIDIA/Audio2Face-3D](https://github.com/NVIDIA/Audio2Face-3D)).

Setting it up:
- The SDK needs CUDA 12.8 or later but below 13.0, and TensorRT 10.x, so on Arch it belongs in an Ubuntu container.
- Audio2Emotion is gated behind a Hugging Face click-through. Skip it and set each take's emotion from the story file instead, which the SDK supports.

Two cautions:
- **Language:** the models learned from actors speaking English and Mandarin, and I found no Japanese test anywhere ([Audio2Face-3D paper](https://arxiv.org/html/2508.16401v1)).
- **Licence:** the models are under the NVIDIA Open Model License, which allows commercial use but is revocable and can be updated ([licence text, 2025-04-28](https://open.windriver.com/info/uni-license-list/licenses/nvidia-open-model-2025-04-28.html)).

The better integration gives the SDK's solver MHR's own 72 shapes, wrapped onto its identity mesh, so it fits MHR weights directly. Going through ARKit instead loses shapes ARKit lacks: lipTightener, cheekSuck, the nostril shapes and the separate lip quadrants. The jaw, eye and tongue outputs go to `c_jaw`, `l_eye`/`r_eye` and the tongue chain.

The story file already holds every line's Japanese text, so a deterministic fallback costs little:
1. pyopenjtalk (MIT) turns the text into phonemes ([pyopenjtalk](https://github.com/r9y9/pyopenjtalk)).
2. The Montreal Forced Aligner times them against the audio; its 3.0 evaluation reports mean boundary errors under 15 ms on Japanese ([MFA 3.0](https://papers.cool/arxiv/2606.18466)).
3. A viseme track follows, timed to each mora.

Two more audio options fit as checks or alternatives:
- **uLipSync's method:** matching MFCCs against vowel profiles, MIT-licensed and labelled in hiragana. It is simple enough to reimplement as an audio-only check ([uLipSync](https://github.com/hecomi/uLipSync)).
- **LAM_Audio2Expression (Alibaba, Apache-2.0):** a second neural candidate for an A/B test ([LAM_Audio2Expression](https://github.com/aigc3d/LAM_Audio2Expression)).

Most research face trackers and audio-to-face models cannot be used in a sold game. EMOCA is non-commercial ([EMOCA licence](https://github.com/radekd91/emoca/blob/release/EMOCA_v2/LICENSE)), and FaceFormer's permissive code is trained on VOCASET, which is free only for non-commercial research ([FaceFormer](https://github.com/EvelynFan/FaceFormer); [VOCA](https://github.com/TimoBolkart/voca)).

Mapping onto MHR is now a lookup, because Meta publishes the 72 names in index order ([face-expressions.md](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md)). Nearly everything maps by name:

| ARKit | MHR |
|---|---|
| eyeBlink | eyesClosed |
| eyeSquint | lidTightener |
| eyeWide | upperLidRaiser |
| jawOpen | jawDrop |
| mouthPucker | lipPucker, both sides |
| mouthFunnel | the four lipFunneler quadrants |
| mouthRoll | lipSuck |
| mouthClose | most plausibly the four lipsToward shapes, FACS's "lips toward each other" (to confirm) |

Only tongueOut has no blendshape, because MHR's tongue is a joint chain. Ten MHR shapes have no ARKit source and can follow simple rules: the cheekSuck, lipTightener and nasolabialFurrow pairs, and the two nostril pairs. Meta's compskin rig lists antagonist pairs that must never fire together, such as cheekSuck against cheekPuff and eyesClosed against upperLidRaiser ([compskin](https://github.com/facebookresearch/compskin/blob/main/rig/riglogic.py)). Naming the routes takes about a day. The real work is calibrating gains, because MHR's 1.0 is not ARKit's 1.0. The best way is to fit the gains until MediaPipe, run on a rendered MHR face, reproduces the source landmarks.

MetaHuman Animator keeps a place, but a narrower one than the list assumed:
- Its facial solving now runs offline on Linux ([MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine)).
- Its solver combines video and depth "with a MetaHuman representation of the performer" ([MetaHuman Animator launch](https://www.metahuman.com/news/delivering-high-quality-facial-animation-in-minutes-metahuman-animator-is-now-available)).
- Its audio solve has head-movement, blink and mood parameters that Audio2Face lacks ([Epic: audio-driven animation](https://dev.epicgames.com/documentation/metahuman/audio-driven-animation)).

Its output, though, is MetaHuman's roughly 250 control curves. The best published remap, ARKitRemap's RigMapper definition (164 curves in, 52 out), reaches a mean R² of 0.92. Against real iPhone capture it correlates at 0.96 for the jaw, 0.94–0.96 for the brows, 0.88 for smiles and 0.87 for blinks, and tongue tracking is weak ([ARKitRemap](https://github.com/Dylanyz/ARKitRemap)). Driving MHR from MetaHuman Animator therefore adds a lossy hop.

There is also a setup question. In 5.7 the Linux build disabled MetaHuman Identity creation, because marker tracking needed DirectX 12 ([MetaHuman 5.7 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-7-release-notes)). Whether 5.8's mono-video solve needs such an Identity, or a cloud step, is unconfirmed. And on AI takes, MetaHuman Animator's biggest advantage, lip contact read from real video, is exactly what the source can't supply.

In Unreal, each take becomes a baked AnimSequence rather than live ARKit curves. It holds:
- **72 float curves named exactly like the imported morph targets.** The morphs are renamed at export from `shape_c_45`–`116` to Meta's names, because Unreal binds curves to morphs by name, ignoring case ([ARKitRemap conventions](https://github.com/Dylanyz/ARKitRemap/blob/main/reference/conventions.md)).
- **Bone keys** for the jaw, eyes, tongue and head.

Editor Python writes it with `AnimationLibrary.add_float_curve_keys` ([Epic: AnimationLibrary](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AnimationLibrary)), keyed to the clip, never to scene time. Every take then earns an objective score without anyone judging the scare:
1. Render the MHR head with the solved curves from the take's camera.
2. Run MediaPipe on the render.
3. Report landmark error per face region against the source, plus the offset between audio onsets and lip opening.

## Hair can match MetaHuman; clothing tops out at good game clothing

### Hair, brows and lashes

Hair is where the honest answer is most encouraging. Everything that makes MetaHuman hair look good belongs to Unreal and binds to any skeletal mesh: strand rendering, RBF-interpolated binding, Auto LOD, Niagara's guide simulation and the Hair Card Generator. The one condition is UVs. A binding can carry a groom between meshes of different topology only when "both the Source and Target meshes share the same UV mapping" ([Epic: groom bindings](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-bindings-for-grooms-in-unreal-engine)). MetaHuman grooms are bound to Epic's archetype head, whose UVs MHR doesn't share, so moving them across takes a one-time refit per groom ([Epic forum](https://forums.unrealengine.com/t/using-metahuman-grooms-with-non-mhc-meshes/226299)).

Every MHR cast member does share MHR's UVs, though, so **a groom made once on the MHR base head binds to each of them**, with the base head as the source mesh. Two requirements:
- Groom on the UV-carrying FBX head, not `MHR_head.obj`.
- Turn on the GPU Skin Cache.

The gaps in the pipeline are export and cards. Blender 4.2 and later export hair curves to Alembic ([Blender 4.2 notes](https://developer.blender.org/docs/release_notes/4.2/pipeline_assets_io/)), but write them as "zero-width curves" ([Blender manual](https://docs.blender.org/manual/ru/4.4/files/import_export/alembic.html)). Unreal then falls back to defaults ([Epic: Alembic for grooms](https://dev.epicgames.com/documentation/unreal-engine/using-alembic-for-grooms-in-unreal-engine)):
- without `groom_width`, every strand is 1 cm wide;
- without `groom_root_uv`, root UVs are projected onto a sphere;
- without `groom_guide`, the guides are generated.

The fix is an exporter that writes those attributes. The options:
- **GroomForge Pro:** paid ([GroomForge](https://superhivemarket.com/products/groomforge)).
- **Groom Exporter:** free, but documented only for Windows and Blender 4.1 ([Groom Exporter](https://turbocheke.gumroad.com/l/Groomexporter)).
- **A small exporter of our own.**

Epic's Hair Card Generator, a Dataflow graph in 5.8, makes card LODs from the same groom for free. It is experimental, though, and rests on a fragile stack of Python machine-learning packages; every documented fix is a Windows path ([Epic: Hair Card Generator in Dataflow](https://dev.epicgames.com/documentation/metahuman/hair-card-generator-in-dataflow-in-unreal-engine?lang=en-US); [Epic forum](https://forums.unrealengine.com/t/hair-card-generator-error/2567348)). Blender card add-ons at $13–40 are the fallback ([Simple Hair Cards](https://superhivemarket.com/products/simple-hair-cards); [Fiberbake](https://superhivemarket.com/products/fiberbake-hair-cards)).

The rendering cost suits close-up romance; Linux is the weak point. No authoritative per-character cost exists for Unreal. As a reference point, Indiana Jones and the Great Circle budgeted 2 ms for strand simulation and rendering on minimum spec, with about a dozen characters in its worst case ([Advances 2025](https://www.advances.realtimerendering.com/s2025/content/Strand%20Hair%20in%20IJGC%20-%20Final%20Slides%20%28Post-Conference%29.pdf)). One or two characters on an RTX 3090 is the comfortable case for strands at LOD 0–1 with cards below. On Linux, two warning signs:
- Search extracts of Epic's groom platform page disagree on whether Linux is listed ([Epic: groom platform support](https://dev.epicgames.com/documentation/unreal-engine/groom-platform-support-in-unreal-engine?lang=en-US)).
- Packaged Linux builds have historically drawn cards instead of strands ([Epic forum](https://forums.unrealengine.com/t/metahuman-groom-hairstrands-on-linux-vulkan/498241)).

So a packaged test belongs in the first fortnight.

The real bottleneck is authoring hairstyles. Unreal has no grooming tool ([Epic: hair rendering](https://dev.epicgames.com/documentation/unreal-engine/hair-rendering-and-simulation-in-unreal-engine)), and AI doesn't fill the gap: **every photo- or text-to-strands model whose licence could be checked is non-commercial**. DiffLocks forbids "production of other artifacts for commercial purposes" ([DiffLocks](https://github.com/Meshcapade/difflocks)), and HAAR, NeuralHaircut, HairStep, MonoHair, CT2Hair, GaussianHaircut and Im2Haircut all carry CC BY-NC terms ([HAAR](https://github.com/Vanessik/HAAR); [GaussianHaircut](https://github.com/eth-ait/GaussianHaircut)).

The usable tools:
- **Blender's hair curves:** free, and native on Linux.
- **Sisir:** free including commercial use according to its press coverage, but Windows-only, with a DirectX 12 render module ([CG Channel](https://www.cgchannel.com/2026/07/sisir-is-a-promising-new-free-standalone-hair-grooming-tool/)).
- **Bought Fab grooms that ship an Alembic file**, each refit once onto the MHR head.

The 2026-10-21 decision to try Sisir on "the archetype groom head" still works, with the MHR base head as that archetype, provided Sisir runs under Proton.

Stylised twin tails are easiest as mesh hair on bone chains driven by Kawaii Physics. Strand twin tails would need Niagara's guide simulation or 5.7's joint-based groom deformation ([UE 5.7](https://www.unrealengine.com/news/unreal-engine-5-7-is-now-available)); nobody has tested either together with Kawaii.

Brows and lashes run on the same engine. MetaHuman makes them as separate grooms within a facial-hair budget of 10,000 strands at LOD 0 and 5,000 at LOD 1 ([Epic: MetaHuman LOD specifications](https://dev.epicgames.com/documentation/en-us/metahuman/platform-support-and-lod-specifications-for-metahumans)). That makes strand brows and lashes the best quality per millisecond in a close-up.
- **Brows:** painted brows alone hold up only for thin, straight brows ([Polycount](https://polycount.com/discussion/comment/2558745)). The better recipe is a soft painted base in the albedo, which the projected photos already contain, under a small strand groom that drops out at distance.
- **Lashes:** they must be separate geometry, because they overhang the lid and shadow the eye. ICT-FaceKit's lash strips are a ready MIT-licensed fallback.

One MHR-specific risk sits under both. MHR blinks are morph targets, and the only evidence that bound grooms follow morph deformation is a thread from the UE 4.25 era ([Polycount](https://polycount.com/discussion/comment/2742792)). If 5.8 doesn't follow them, the lashes become skinned strips with one shape baked per expression, like the eye occlusion.

### Clothing

Clothing has a licence trap at its centre:
- **GarmentCode's code is MIT.** Its box-mesh generator, which welds seams and keeps per-panel UVs, doesn't import NVIDIA Warp, so welded, UV-mapped garment meshes can come from MIT code alone ([boxmeshgen.py](https://github.com/maria-korosteleva/GarmentCode/blob/main/pygarment/meshgen/boxmeshgen.py)).
- **Its draping simulator is not.** It is a fork of NVIDIA Warp 1.0.0-beta.6 limited to "research or evaluation purposes only" ([NvidiaWarp-GarmentCode licence](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode/blob/main/LICENSE.md)), so garments draped with it cannot ship in a sold game.

Upstream Warp moved to Apache-2.0 at 1.6.2, and its simulation module now lives in Newton, also Apache-2.0 ([Warp changelog](https://github.com/NVIDIA/warp/blob/main/CHANGELOG.md); [Newton](https://github.com/newton-physics/newton/blob/main/LICENSE.md)). Porting the fork's additions to Newton (attachment constraints, body-part drag, push-out from the body) is the long-term route.

The route available today is Blender cloth. The project's garment tool already writes unwelded panels placed round the body, plus a seams file. Each seam pair becomes a sewing spring, and a headless script ramps sewing force and shrink, then welds the seams ([Blender: ClothSettings](https://docs.blender.org/api/current/bpy.types.ClothSettings.html)).

Unreal should run garments, not sew them. Chaos Cloth's Dataflow editor is production-ready and the default in 5.8 ([Epic: Chaos Cloth 5.8](https://dev.epicgames.com/community/learning/tutorials/Wb2V/unreal-engine-chaos-cloth-updates-5-8)). It takes one of two inputs ([Epic: StaticMeshImport_v2](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAssetDataflowNodes/FChaosClothAssetStaticMeshImport-?lang=en-US)):
- a welded mesh whose 2D pattern sits in a UV channel;
- a USD file with sewings, from Marvelous Designer or CLO.

Nothing documents Chaos sewing flat panels from scratch, and a practitioner found the native solver "isn't designed to drape high-res self-colliding cloth" ([Versluis](https://www.versluis.com/2025/06/alembic-workflow-from-iclone-to-md-to-ue-via-blender/)). The likely input is therefore the draped, welded Blender mesh with each panel's flat coordinates in a second UV channel; one import will prove it. Dataflow's TransferSkinWeights node then transfers the body's skin weights by weight inpainting ([Epic: TransferSkinWeights](https://dev.epicgames.com/documentation/unreal-engine/node-reference/Dataflow/TransferSkinWeights?lang=en-US)).

Fitting is easier on MHR than on MetaHuman:
- Made-to-measure patterns from each cast member's measures give the truest fit.
- Every body is the same mesh, so a garment bound to the base body with Surface Deform follows any identity exactly.

The 2026-10-20 plan to resize garments through Unreal's Outfit Asset needs a test first, for three reasons:
- Epic documents it only on MetaHuman bodies.
- In 5.6, resizing overwrote custom skinning ([Epic: parametric clothing](https://dev.epicgames.com/documentation/unreal-engine/getting-started-with-parametric-clothing?lang=en-US)).
- A 5.8 forum report has MetaHuman Creator's Dataflow stripping the simulation mesh ([Epic forum](https://forums.unrealengine.com/t/intended-workflow-for-resizing-a-chaos-outfit-asset-while-preserving-cloth-simulation/2762838)).

At runtime, garments tier by how they fit:
- **Tight clothes:** skinned only.
- **Loose clothes:** Chaos with a coarse simulation mesh, about 0.35 ms per asset once optimised ([Epic forum](https://forums.unrealengine.com/t/how-to-setup-low-budget-chaos-cloth-sim/2701370)).
- **Background skirts:** Kawaii chains.
- **ML Cloth:** set aside, because it predicts quasi-static wrinkles, not swing ([Epic: ML Cloth](https://dev.epicgames.com/documentation/unreal-engine/machine-learning-cloth-simulation-overview)).

The quality ceiling is good game clothing. GarmentCode's vocabulary covers shirts, collars, hoods, skirts, trousers and dresses, but has no pleats, buttons, zips, plackets, pockets or linings ([garment programs](https://github.com/maria-korosteleva/GarmentCode/tree/main/assets/garment_programs)). A pleated school skirt needs a new garment program, and close-ups need added thickness, stitch normals and buttons. The result sits below Epic's Marvelous-Designer-made MetaHuman outfits on surface detail, and above MetaHuman on fit for custom bodies, where a 5.8.3 user describes "hours of manual fitting per set" ([Epic forum](https://forums.unrealengine.com/t/fitting-armour-clothing-to-metahumans-in-ue-5-8-3-best-workflow-to-avoid-hours-of-manual-fitting-per-set/2839852)).

Hero garments can later pass through Marvelous Designer into the same Dataflow template. Personal costs $280 a year and runs on Windows and macOS; Linux comes only with the $2,300-a-year Enterprise tier ([CG Channel](https://www.cgchannel.com/2026/08/clo-virtual-fashion-releases-marvelous-designer-2026-1/)). Fabrics come CC0 from ambientCG ([ambientCG licence](https://docs.ambientcg.com/license/)).

## The suggested tool list holds up after two swaps and five fixes

The local Claude's list picked the right families of tools, and nothing on it is a dead end. Measured against the research, two items should be replaced and five need fixes that change how they are used. The rest stand.

| Suggested | Verdict | What changes |
|---|---|---|
| MetaHuman Animator for hero faces | Keep as an option | Its facial solve runs offline on Linux in 5.8, but it solves only to MetaHuman's ~250 controls. On MHR that needs a mapping we would build, possibly a cloud-made Identity (unconfirmed), and AI takes with synthetic lips blunt its edge. Use it only if the close-up test says it wins. |
| MediaPipe Face Landmarker for eyes, brows and head, smoothed | Keep, calibrated | No tongueOut. Jaw sideways and forward, cheekPuff and dimples read near zero, jawOpen saturates, and eyes and brows read low (×2–3 gain). Needs a neutral baseline and gains per take, zero-phase smoothing that leaves blinks alone, and subject-relative left and right. |
| Audio2Face-3D for lips, jaw and tongue, offline | **Fix:** use the SDK | The MIT SDK in an Ubuntu CUDA 12.x container, not the UE plugin, whose local mode is Windows-only and built for UE 5.4–5.6 ([ACE docs](https://docs.nvidia.com/ace/ace-unreal-plugin/2.5/ace-unreal-plugin-audio2face.html)). Skip the Hugging-Face-gated Audio2Emotion. Untested on Japanese, so A/B it against pyopenjtalk + MFA visemes and LAM-A2E. Solve straight onto MHR's 72. |
| ARKit-52→MHR-72 table from ComfyUI's SAM3DBody FaceExpression node | **Replace** | The table was "hand-derived by visual inspection" while MHR's axes were anonymous ([source](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/sam3d_body/face_expression.py)). Against Meta's names, about 12 axes are misrouted, and pucker, funnel, press, roll and close are never used. Write a by-name map from [Meta's list](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md), then fit the gains. |
| ARKit curves driving characters in Unreal | **Fix:** bake MHR curves | Bake 72 curves named after MHR's renamed morphs, plus jaw, eye, tongue and head bone keys, into AnimSequences offline. Use RigMapper only for live tuning. |
| Head parts from Blender Studio base meshes and MPFB2 (CC0) | **Replace** | ICT-FaceKit (MIT) for eyeballs, occlusion, tear line and lashes; GNM Head (Apache-2.0) or ICT for teeth, gums and tongue. The CC0 sets stay as a lower-fidelity fallback. |
| Fitted and skinned to MHR's joints, with a dark mouth bag, in headless Blender | **Fix:** more steps | Cut the sealed shell first, since the eye, teeth and tongue joints have no skinned vertices. Bind the strips with Surface Deform and bake a shape per expression. Add eyelid follow, correct the blink and lip shapes, and measure penetration. |
| Eyebrows painted into the skin texture | **Fix:** add a groom | Paint only a base, then add a small strand groom (or cards) for close-ups. |
| Eyelashes as alpha cards | Keep as fallback | Small strand grooms at LOD 0–1 cost little; ICT's strips or cards below that. Check that lashes follow MHR's morph-based blinks. |
| Sculpted mesh hair plus Kawaii Physics for stylised twin tails | Keep | The proven route; Kawaii is MIT and supports UE 5.3–5.8. It reads as anime next to realistic skin. |
| Blender hair curves → Alembic → Groom for realistic hair | **Fix:** exporter | Needs an exporter that writes width, root UVs, guides and groups. Groom on the UV-carrying MHR FBX head and transfer bindings across the cast. Test strands in a packaged Linux build. |
| Hair cards for realistic hair | Keep for LOD 2+ | Not for the close-up LOD. Use the Hair Card Generator if its Python stack runs on Linux, otherwise a cheap Blender card add-on. |

The ComfyUI table's errors show what visual inspection gets wrong:
- It routes MediaPipe's blink to `eyesLookDown` and look-down to `eyesClosed`, so a tracked blink never fully closes the eye.
- It feeds `mouthLeft`/`mouthRight` into `lipPucker`.
- It feeds `mouthFrown` into `lipStretcher`.

As a result, rounded Japanese vowels get no pucker or funnel at all ([ComfyUI face_expression.py](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/sam3d_body/face_expression.py)). SAM 3D Body itself is no substitute, because one paper found all 72 of its expression outputs identically zero ([MHRGait, arXiv 2607.29083](https://arxiv.org/pdf/2607.29083)).

The list also left out pieces that decide close-up quality more than any it named:
- the skin itself: photo projection onto MHR's UVs, de-lighting, and a micro-normal;
- the eye stack's occlusion sheet, tear line and lid follow;
- MHR's body correctives;
- a Japanese viseme track driven by the script text, which costs a day and never drifts;
- the per-take score that lets the A/B tests run without anyone judging the scare.

Two better tools surfaced that it couldn't have known about. Meta's published expression names turn the mapping from guesswork into a lookup. Google's GNM Head, released in July 2026, supplies articulated teeth and tongue under Apache-2.0.

## Verdict: MetaHuman quality everywhere except the speaking close-up

The table rates each layer of the MHR route against MetaHuman at the game's two working distances. A close-up here is the project's own definition: a face inside 0.55 m of the player's eye ([DECISIONS](../docs/DECISIONS.md)).

| Layer | What the MHR route reaches | Close-up (face inside 0.55 m) | Medium close-up and wider |
|---|---|---|---|
| Body shape and proportions | Any shape from the desk, beyond realistic ranges too | Beats MetaHuman | Beats MetaHuman |
| Body motion | Kimodo-native, baked exactly as the desk shows it | Beats MetaHuman | Beats MetaHuman |
| Body deformation | Linear skinning plus Pose Driver correctives | Matches once shoulders and hips get correctives | Matches |
| Hair, brows, lashes | The same groom renderer, one shared set of grooms bound to every cast member | Matches if the groom is well made | Matches |
| Eye and mouth parts | ICT and GNM parts, Unreal's Eye and Burley shading | Close if tuned; lid follow is the risk | Matches |
| Skin | Same shading; photo-projected 4K head map, a few painted wrinkle masks | Behind in tight stills (no scan synthesis, few wrinkles) | Close |
| Face deformation | 72 linear shapes plus a handful of combination correctives | Clearly behind on combined speech shapes and strong expressions | Close |
| Face solve | MediaPipe upper face, Audio2Face lips, text visemes | Behind MetaHuman Animator on lip contact and asymmetry | Close |
| Clothing | Made-to-measure GarmentCode, Blender drape, Chaos | Behind Marvelous-Designer-made outfits on detail; ahead on fit | Close |
| Automation and licence | Local, deterministic, Apache-2.0, shareable | Beats MetaHuman | Beats MetaHuman |

What breaks a close-up first, in order:
1. Dead eyes: no refraction, occlusion sheet or wet line.
2. Lids that miss the gaze or cut through the eyeball.
3. A see-through mouth, or teeth poking through the lips.
4. Waxy skin.
5. Photo lighting or lash shadows baked into the texture.

Texture resolution comes last. Every item on that list can be fixed with the open parts and engine features above, which is why still or slow close-ups can get close to MetaHuman. What cannot be fixed in months is motion in the lower face: combined speech shapes, lip seal and roll, asymmetric micro-expressions, and the wrinkles that come with them.

Nobody has published a side-by-side of a custom-part head against a MetaHuman in UE 5.6–5.8, so "by how much" rests on proxies:
- **Face deformation.** MetaHuman's departures from linearity show the size of what a linear rig misses: about 54 px at the worst vertex for jaw plus smile in a 1080p extreme close-up, and over 200 px for pucker with the jaw open. At a quarter of that face size on screen, the jaw-plus-smile miss falls to about a dozen pixels.
- **Face solve.** Even MetaHuman's own curves lose information when remapped (R² 0.92 into ARKit), so a two-hop path from MetaHuman Animator onto MHR would not deliver its full quality either.
- **Skin.** A 4K head map gives 106 px/cm against the 128 px/cm a 1080p extreme close-up shows.
- **Body.** Without correctives, the body sits 3–5 mm from MHR's own result.

At this game's shot sizes, that means:
- **Medium close-ups and wider:** read as right.
- **Close-ups inside 0.55 m:** read as right when still or slow, and visibly less alive than a MetaHuman during speech.
- **Extreme close-ups of speech or strong expression:** MetaHuman stays clearly ahead.

That remaining gap is what a long specialist effort bought. 3Lateral, founded in 2008, joined Epic in 2019, Cubic Motion followed in 2020, and MetaHuman left Early Access only in June 2025 ([Epic, 2019](https://www.unrealengine.com/blog/epic-games-welcomes-3lateral-to-unreal-engine-team); [3Lateral](https://3lateral.com/about-us); [MetaHuman leaves Early Access](https://www.metahuman.com/news/metahuman-leaves-early-access-with-a-feature-packed-new-release)). A one-person studio should not try to rebuild a RigLogic-class face, scan-based skin synthesis or a 4D-trained solver. It doesn't need them for most of a game, and it can measure whether it needs them for the rest.

## Build MHR-first and open a MetaHuman branch only on evidence

### The architecture

The system is a compiler with one source. Each cast member is a small text record in the desk:
- 45 identity weights and the scale parameters;
- the face fitter's photo bend;
- the measures;
- choices of skin, eyes, hairstyle and garments.

A local, headless pipeline turns that record into Unreal assets, with no cloud step, in two halves.

**In Blender's Python module (offline):**
1. Bake the identity at LOD1 and push it through MHR's LOD mappings.
2. Strip the collision nulls and rename the 72 shapes to Meta's names.
3. Cut the eyes and mouth and fit the face parts.
4. Project the photo skin.
5. Drape the garments.
6. Export FBX, textures and groom Alembics.

**In editor Python (through UnrealClaude or the command-line editor):**
1. Import the assets.
2. Build the materials.
3. Bind the shared grooms from the base head.
4. Instance the cloth Dataflow template.
5. Add the Pose Driver correctives and the Kawaii soft bones.
6. Write the AnimSequences for Kimodo motions and face takes.

The takes pipeline runs alongside it, offline, per take:
1. Run MediaPipe and the Audio2Face-3D container.
2. Merge the results by face region.
3. Map them onto MHR's 72 shapes plus the jaw, eye and tongue bones.
4. Score the result against the source video.

The desk already runs MHR, so these same characters replace its temporary bodies and play Kimodo motions there unchanged. That keeps "text is the truth" and the desk-to-Unreal match intact.

Is a hybrid wiser? Wiser than the current plan, yes. Wiser than pure MHR, only for the faces that need it.
- **The 2026-10-20 route** (MetaHuman makes every final character) puts MetaHuman's cloud jobs, realistic ranges, retargeting drift and licence on every character, including the parts MHR does better.
- **The opposite mix**, MHR bodies wearing MetaHuman heads, has few precedents and an unclear licence for mixing parts ([Epic forum](https://forums.unrealengine.com/t/metahuman-properly-attaching-a-head-to-a-custom-rig-body-no-sockets/1261475)).
- **The defensible hybrid works per character.** If the close-up test fails, a hero is compiled a second time through 5.8's full-body Mesh to MetaHuman, from the same MHR design ([MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine)). It is animated through the IK Retargeter path the project already scripted, previewable in the desk through OpenRigLogic's Python bindings, and kept in the user's own project.

That hybrid has concrete costs:
- Grooms and outfits don't move between MHR and MetaHuman heads without a refit, because groom bindings need matching UVs.
- Each face change is a cloud job run by hand, not something Generate can do unattended.
- The AI clause rules out using that character's renders as image prompts for the takes.

That is why it should be opened only on evidence.

### The first tests, and what each one decides

Each test below runs on the user's machine (Arch, RTX 3090, UE 5.8.3) and settles one fork in the plan. T1–T6 take about two weeks together; T7 needs the face built first.

| Test | What to run | Effort | Decides |
|---|---|---|---|
| T1: MHR into Unreal | Strip the 77 collision nulls, import the LOD1 FBX with morphs, count the bones and read the morph names. Play one Kimodo motion baked offline. Render all 72 shapes at full weight on one contact sheet. | 1 day | Whether MHR is a sound skeletal mesh as shipped. Also confirms the names, the left/right convention, the mouthClose route, and what jawDrop does to the sealed lips. |
| T2: Japanese lips | The Audio2Face-3D SDK in an Ubuntu container, without Audio2Emotion. Run 3–5 takes through models v3.0 and Claire v2.3.1, against LAM-A2E and a pyopenjtalk + MFA viseme track, on the bare MHR head. Score by landmark error and audio-onset sync. | 2 days | The default lip source for Japanese (watch う, ん, っ and devoiced vowels). Whether any download needs a Hugging Face account. |
| T3: MetaHuman Animator on Linux | One take through the mono-video solve and the audio solve. Log every Identity, cloud or login step. Judge the solve on a synthetic mouth. | 1 day | Whether a hero-face branch is practical here without per-take cloud steps. This is the comparison the project already planned for the pilot. |
| T4: Hair on Linux | A short strand groom plus brows and lashes, groomed in Blender on the MHR FBX head and exported with the `groom_*` attributes. Bind to two cast members by transfer. Blink, profile with `stat GPU`, package a Linux build, run the Hair Card Generator, and try Sisir under Proton. | 2–3 days | Whether the hair route works end to end, and what strands cost on the 3090. Whether lashes follow morph blinks. Blender or Sisir for authoring; free or paid cards. |
| T5: Cloth | A GarmentCode skirt draped headless in Blender on an MHR body, welded with pattern UVs, imported into Chaos Dataflow. Outfit Asset resizing between two MHR bodies. One Alembic geometry-cache import. | 2–3 days | Which input format Chaos takes. Outfit Asset resizing or per-body fitting in Blender. Whether Alembic import works in the Linux editor. |
| T6: Body correctives | 10–20 MHR correctives at shoulder and hip key poses on a Pose Driver, against plain skinning, in a slow close shot. | 1 day | Pose Driver alone, or ML Deformer (and whether it trains on Linux). |
| T7: The close-up A/B | After phases 1–3: one cast member's MHR face, driven by the T2 winner, against the same design through full-body Mesh to MetaHuman and MetaHuman Animator (if T3 allows). Same take, close-up and extreme close-up cameras, the game's lights. Shot-review scores plus the user's eye in Play. | 1 day once built | Pure MHR, or MetaHuman for hero faces only. |

### The phased build

| Phase | What gets built | Done when |
|---|---|---|
| 0: Tests | T1–T6 | Each answer is written into LESSONS and DECISIONS |
| 1: Compiler | Desk record → baked LOD chain → cleaned FBX with Meta's morph names → import script; Kimodo baked offline; Pose Driver correctives; soft-tissue bones | Generate puts the cast into Unreal as MHR characters playing Kimodo motion, with no Claude in between |
| 2: Face parts and skin | Cut shell, fitted ICT/GNM parts, eyelid follow, mouth bag, Eye and Burley materials, photo-projected head skin, penetration checks | The contact sheet passes, and a still close-up looks right to the user |
| 3: Takes | MediaPipe + the T2 winner + visemes → merged → MHR's 72 plus bones → one AnimSequence per take, with scores | A scene's takes play in Unreal with a score each, and T7 runs |
| 4: Hair | Shared grooms on the base head, our Alembic exporter, bindings, cards, twin-tail chains | Every cast member has hair, brows and lashes from the shared library |
| 5: Clothing | Blender drape script, Dataflow template, masks for skin covered by clothing, fabrics; later the Newton port | A garment goes from pattern to Unreal with only a look check |
| 6: Hero faces, only if T7 says so | Full-body Mesh to MetaHuman from the same design, MetaHuman Animator, groom refits, garment re-skinning | Hero close-ups use MetaHuman; the rest of the cast stays MHR |

These durations are my estimate; no published benchmark supports them. Phase 0 takes about two weeks, phases 1–3 another six to eight, and phases 4–5 four to six weeks of pipeline work: roughly three to four months to a complete system at mid-shot quality. After that:
- a new cast member is mostly compute plus a look check;
- a new hairstyle remains several days of artist work;
- a new garment type is a few hours of garment programming.

### Licence, account and platform risks

| Risk | Consequence | Mitigation |
|---|---|---|
| GarmentCode's draping simulator is research-only ([licence](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode/blob/main/LICENSE.md)) | Garments it drapes can't ship | Drape in Blender; port its additions to Newton (Apache-2.0) |
| Every strand generator checked is non-commercial ([DiffLocks](https://github.com/Meshcapade/difflocks)) | No AI-made grooms in a sold game | Blender, Sisir, Fab grooms that ship an Alembic file |
| The NVIDIA Open Model License covers Audio2Face-3D, and Kimodo's models too; it is revocable and can be updated ([text](https://open.windriver.com/info/uni-license-list/licenses/nvidia-open-model-2025-04-28.html); [Kimodo card](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1/blob/main/README.md)) | Terms can change under a shipped pipeline | Archive each model's licence with it; keep the text-viseme fallback |
| Hugging Face gating: Audio2Emotion's click-through and SAM 3D Body's access request | Account sign-ups | Skip both; T2 checks Audio2Face's own downloads |
| MetaHuman's AI clauses, EULA updates 20 and 21, against "prompt-based input into Generative AI Programs" and using MetaHumans to train or test AI ([change log](https://www.unrealengine.com/eula-change-log/unreal)) | On a conservative reading, a MetaHuman render used as a MiniMax image prompt, or MetaHuman data used to fit a model, breaks the EULA | Keep MetaHuman renders out of generative tools; MHR renders are free of this restriction |
| MetaHuman's cloud steps: login, consent, network access, multi-minute jobs that time out | Unattended Generate fails, and character data goes to Epic's servers | MetaHuman only in the optional hero branch, run by hand |
| ARKitRemap is now CPAL with the Commons Clause: "Nobody may sell or repackage it" ([ARKitRemap](https://github.com/Dylanyz/ARKitRemap)) | Its files can't ship as part of our tools | Reuse its fitting method, not its files |
| Face models built on FLAME or trained on non-commercial data. FLAME 2023 Open also bars "pornographic" and "fake… misleading" content ([FLAME](https://flame.is.tue.mpg.de/modellicense.html)) | Can't ship, and the content clause clashes with intimate horror romance | Keep them out of the pipeline |
| Permissive but not CC0: MHR and GNM (Apache-2.0), ICT (MIT), Lee Perry-Smith (CC BY 3.0) | The project's rule says "CC0 or ours" | Keep notices beside the files and in the credits; widen the rule explicitly (the user's call) |
| Windows-only tools: Sisir, the free Groom Exporter, Audio2Face's Unreal plugin, Marvelous Designer Personal, CC5, Live Link Face, MetaHuman body capture | Unavailable on Arch | The Linux routes above; test Sisir under Proton |
| Linux unknowns in the engine: packaged strands, the Hair Card Generator's Python stack, ML Deformer training, a 5.8 Alembic import crash report ([forum](https://forums.unrealengine.com/t/editor-crashes-when-importing-alembic-cloth-as-geometry-cache-array-index-out-of-bounds-2147483647-into-array-of-size-2/2840452)) | Features degrade silently on Linux | Each one is a phase-0 test |
| Arch's packaged CUDA may already be 13.x, outside the SDK's window | Audio2Face won't build natively | Ubuntu 22.04 container with CUDA 12.x |

Fees don't separate the two routes. Since UE 5.6, MetaHumans fall under the standard UE EULA with no MetaHuman-specific fee, and Unreal's own 5% royalty above $1 million lifetime gross applies to a UE game either way ([metahuman.com licence](https://www.metahuman.com/license); [Unreal FAQ](https://www.unrealengine.com/en-US/faq?active)). No Epic text found either allows or forbids putting MetaHuman grooms, eyes or materials on a non-MetaHuman character. MetaHuman-derived files therefore stay in the user's own project, as the project's rules already require.

## Conclusion

MetaHuman's lead is narrower than it looks and deeper where it remains. It is narrower because rendering, hair, eyes, clothing and animation are engine features or open parts that an MHR character can use as fully as a MetaHuman. It is deeper because the face rig and its solver are the product of a long specialist effort no small studio should try to repeat. So the useful question is not "can we build MetaHuman" but "do this game's shots need MetaHuman's face", and the project's own shot review can answer that on a real take.

Two facts tilt the answer toward MHR for this studio in particular. The AI-generated takes have synthetic lips, which blunts MetaHuman Animator's main advantage. And MetaHuman's AI clause makes a MetaHuman the riskier character to show a generative video model, while an Apache-2.0 MHR render can go anywhere.

The licence picture inverts the usual intuition. The tools that look most "open" (GarmentCode's simulator, every strand generator, the FLAME-based face trackers) are the ones a commercial game cannot ship with. The big-lab releases (Meta's MHR, Google's GNM, USC's ICT-FaceKit, NVIDIA's Audio2Face SDK) ship with a notice.

The single decision that makes a one-person system feasible is to keep every character on one topology. It turns hair, clothing, face parts, correctives and mappings into one-time work, which is the same reason MetaHuman scales, now on a mesh the studio owns.
